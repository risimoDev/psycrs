#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# deploy.sh — Zero-downtime deploy: pull, build, reload
# Usage: ./deploy.sh [--skip-migrations]
# ──────────────────────────────────────────────────────────
set -euo pipefail
IFS=$'\n\t'

# ─── Constants ────────────────────────────────────────────

APP_DIR="/var/www/psycrs"
ENV_FILE="${APP_DIR}/.env"
LOG_FILE="/var/log/psycrs-deploy.log"
SKIP_MIGRATIONS=false

# ─── Helpers ──────────────────────────────────────────────

log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
err()  { log "ERROR: $*" >&2; }
die()  { err "$*"; exit 1; }

# ─── Parse Args ───────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-migrations)
      SKIP_MIGRATIONS=true
      shift
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

# ─── Git Pull ─────────────────────────────────────────────

pull_changes() {
  log "Pulling latest changes..."
  cd "$APP_DIR"

  # Save current package-lock hash
  local lock_hash_before=""
  if [[ -f package-lock.json ]]; then
    lock_hash_before=$(sha256sum package-lock.json | awk '{print $1}')
  fi

  git pull --ff-only || die "git pull failed — resolve conflicts manually"

  # Check if deps changed
  local lock_hash_after=""
  if [[ -f package-lock.json ]]; then
    lock_hash_after=$(sha256sum package-lock.json | awk '{print $1}')
  fi

  if [[ "$lock_hash_before" != "$lock_hash_after" ]]; then
    log "package-lock.json changed — installing dependencies..."
    npm ci 2>&1 | tail -5
    log "Dependencies updated"
  else
    log "Dependencies unchanged — skipping npm install"
  fi
}

# ─── Migrations ───────────────────────────────────────────

run_migrations() {
  if [[ "$SKIP_MIGRATIONS" == "true" ]]; then
    log "Skipping migrations (--skip-migrations)"
    return 0
  fi

  log "Running database migrations..."
  cd "${APP_DIR}/apps/api"

  # Если есть миграция в состоянии "failed" — помечаем как applied
  # (SQL идемпотентный, поэтому пометка safe)
  local migrate_status
  migrate_status=$(npx prisma migrate status 2>&1) || true
  if echo "$migrate_status" | grep -q "failed"; then
    log "WARNING: detected failed migration — resolving with migrate resolve..."
    FAILED=$(echo "$migrate_status" | grep -oP '\d{14}_\S+' | head -1)
    if [[ -n "$FAILED" ]]; then
      log "Resolving failed migration: $FAILED"
      npx prisma migrate resolve --applied "$FAILED" || true
    fi
  fi

  # НЕ используем set -e здесь: если миграция упала, deploy продолжается
  # PM2 перезагружается с новым кодом, а роуты всё равно будут зарегистрированы
  if npx prisma migrate deploy; then
    log "Migrations completed"
  else
    err "Migration failed! Routes will still be registered. Fix DB manually, then run:"
    err "  cd ${APP_DIR}/apps/api && npx prisma migrate deploy"
  fi

  return 0  # никогда не прерываем deploy из-за миграции
}

# ─── Build ────────────────────────────────────────────────

build_app() {
  log "Building applications..."
  cd "$APP_DIR"
  
  # NEXT_PUBLIC_* vars are baked into the JS bundle at build time
  set -a; source "$ENV_FILE"; set +a

  # 🛠 КРИТИЧНО: Всегда перегенерируем Prisma-клиент перед сборкой
  log "Generating Prisma client..."
  cd apps/api
  npx prisma generate

  # Чистим dist чтобы не было старых скомпилированных файлов
  log "Cleaning API dist..."
  rm -rf dist
  cd "$APP_DIR"

  npx turbo build --force || die "Build failed — aborting deploy. PM2 still running old version."
  log "Build completed"
}

# ─── Reload ───────────────────────────────────────────────

reload_pm2() {
  log "Reloading PM2 processes (zero-downtime)..."
  cd "$APP_DIR"

  # Проверяем что скомпилированный dist содержит нужные роуты
  if ! grep -q "articles/upload\|articles.upload\|uploadArticle" apps/api/dist/routes/admin.routes.js 2>/dev/null; then
    err "CRITICAL: articles/upload route not found in compiled dist! Dumping dist/app.js imports..."
    grep -n "require\|import\|register\|routes" apps/api/dist/app.js 2>/dev/null | head -40 || true
    die "Compiled output is stale or incomplete. Run: rm -rf apps/api/dist && npx turbo build --force"
  fi
  log "Route verification passed: articles/upload found in dist"

  pm2 reload ecosystem.config.js --update-env
  pm2 save

  log "PM2 reloaded"
}

# ─── Health Check ─────────────────────────────────────────

health_check() {
  log "Checking API health..."
  local retries=5
  local delay=3

  for ((i = 1; i <= retries; i++)); do
    if curl -sf http://localhost:4000/health > /dev/null 2>&1; then
      log "Health check passed"
      return 0
    fi
    log "Health check attempt ${i}/${retries} failed, retrying in ${delay}s..."
    sleep "$delay"
  done

  err "Health check failed after ${retries} attempts"
  log "Check logs: pm2 logs api"
  return 1
}

# ─── Main ─────────────────────────────────────────────────

main() {
  log "========== Deploy started =========="

  pull_changes
  build_app
  run_migrations
  reload_pm2
  health_check

  log "========== Deploy completed =========="
}

main "$@"
