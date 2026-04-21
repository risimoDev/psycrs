#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# install.sh — First deploy: install, migrate, build, start
# ──────────────────────────────────────────────────────────
set -euo pipefail
IFS=$'\n\t'

# ─── Constants ────────────────────────────────────────────

APP_DIR="/var/www/app"
ENV_FILE="${APP_DIR}/.env"
LOG_FILE="/var/log/app-install.log"

# ─── Helpers ──────────────────────────────────────────────

log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
err()  { log "ERROR: $*" >&2; }
die()  { err "$*"; exit 1; }

# ─── Preflight Checks ────────────────────────────────────

check_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    die ".env file not found at ${ENV_FILE}. Run setup-server.sh first."
  fi

  local required_vars=(
    DATABASE_URL
    JWT_SECRET
    JWT_REFRESH_SECRET
    VIDEO_SIGNING_SECRET
    YOOKASSA_SHOP_ID
    YOOKASSA_SECRET_KEY
    YOOKASSA_WEBHOOK_SECRET
  )

  # shellcheck source=/dev/null
  source "$ENV_FILE"

  local missing=()
  for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" ]]; then
      missing+=("$var")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    die "Missing required env variables: ${missing[*]}"
  fi

  log "Environment variables validated"
}

check_commands() {
  for cmd in node npm npx pm2; do
    if ! command -v "$cmd" &>/dev/null; then
      die "Required command not found: ${cmd}. Run setup-server.sh first."
    fi
  done
}

# ─── Install Dependencies ────────────────────────────────

install_deps() {
  log "Installing npm dependencies..."
  cd "$APP_DIR"
  npm ci --omit=dev 2>&1 | tail -5
  log "Dependencies installed"
}

# ─── Database Migration ──────────────────────────────────

run_migrations() {
  log "Running database migrations..."
  cd "${APP_DIR}/apps/api"

  # Copy .env for Prisma
  if [[ ! -f .env ]]; then
    ln -sf "$ENV_FILE" .env
  fi

  npx prisma migrate deploy
  log "Migrations completed"
}

# ─── Build ────────────────────────────────────────────────

build_app() {
  log "Building applications..."
  cd "$APP_DIR"

  npx turbo build || die "Build failed — aborting"

  log "Build completed successfully"
}

# ─── PM2 Ecosystem Config ────────────────────────────────

create_ecosystem() {
  log "Creating PM2 ecosystem config..."

  cat > "${APP_DIR}/ecosystem.config.js" << 'ECOSYSTEM'
module.exports = {
  apps: [
    {
      name: 'api',
      cwd: './apps/api',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      env_file: '/var/www/app/.env',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
      error_file: '/var/log/pm2/api-error.log',
      out_file: '/var/log/pm2/api-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
    },
    {
      name: 'web',
      cwd: './apps/web',
      script: 'node_modules/.bin/next',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '512M',
      error_file: '/var/log/pm2/web-error.log',
      out_file: '/var/log/pm2/web-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
ECOSYSTEM

  log "PM2 ecosystem config created"
}

# ─── Start / Save ─────────────────────────────────────────

start_pm2() {
  log "Starting applications with PM2..."
  cd "$APP_DIR"

  # Create log directory
  mkdir -p /var/log/pm2

  pm2 start ecosystem.config.js
  pm2 save

  log "PM2 processes started and saved"
}

# ─── Health Check ─────────────────────────────────────────

health_check() {
  log "Checking API health..."
  local retries=5
  local delay=3

  for ((i = 1; i <= retries; i++)); do
    if curl -sf http://localhost:4000/health > /dev/null 2>&1; then
      log "API health check passed ✓"
      return 0
    fi
    log "Health check attempt ${i}/${retries} failed, retrying in ${delay}s..."
    sleep "$delay"
  done

  err "API health check failed after ${retries} attempts"
  log "Check logs: pm2 logs api"
  return 1
}

# ─── Main ─────────────────────────────────────────────────

main() {
  log "========== Starting first deploy =========="

  check_commands
  check_env
  install_deps
  run_migrations
  build_app
  create_ecosystem
  start_pm2
  health_check

  log "========== Deploy completed =========="
  echo ""
  echo "Done! Applications are running via PM2."
  echo "  pm2 status     — view processes"
  echo "  pm2 logs       — view logs"
  echo "  pm2 monit      — monitor resources"
}

main "$@"
