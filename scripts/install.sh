#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# install.sh — First deploy: install, migrate, build, start
# ──────────────────────────────────────────────────────────
set -euo pipefail
IFS=$'\n\t'

# ─── Constants ────────────────────────────────────────────

APP_DIR="/var/www/psycrs"
ENV_FILE="${APP_DIR}/.env"
LOG_FILE="/var/log/psycrs-install.log"

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
  npm ci 2>&1 | tail -5
  log "Dependencies installed"
}

# ─── Database Migration ──────────────────────────────────

run_migrations() {
  log "Running database migrations..."
  cd "${APP_DIR}/apps/api"

  # Ensure Prisma can find DATABASE_URL
  if [[ ! -f .env ]]; then
    ln -sf "$ENV_FILE" .env
  fi

  # Generate Prisma client (needed after fresh clone)
  npx prisma generate

  npx prisma migrate deploy
  log "Migrations completed"
}

# ─── Build ────────────────────────────────────────────────

build_app() {
  log "Building applications..."
  cd "$APP_DIR"

  # NEXT_PUBLIC_* vars must be present at build time (baked into JS bundle)
  # shellcheck source=/dev/null
  set -a; source "$ENV_FILE"; set +a

  npx turbo build || die "Build failed — aborting"

  log "Build completed successfully"
}

# ─── Deploy Nginx Config from Repo ───────────────────────

deploy_nginx_config() {
  local repo_nginx="${APP_DIR}/nginx/psyhocourse.conf"
  local nginx_dest="/etc/nginx/sites-available/psycrs.conf"

  if [[ ! -f "$repo_nginx" ]]; then
    log "No nginx config found in repo — using existing server config"
    return
  fi

  log "Deploying nginx config from repo..."
  cp "$repo_nginx" "$nginx_dest"
  ln -sf "$nginx_dest" /etc/nginx/sites-enabled/psycrs.conf

  if nginx -t 2>/dev/null; then
    systemctl reload nginx
    log "Nginx config updated and reloaded"
  else
    err "Nginx config test failed — check ${nginx_dest}"
    nginx -t
  fi
}

# ─── PM2 Ecosystem Config ────────────────────────────────

create_ecosystem() {
  if [[ -f "${APP_DIR}/ecosystem.config.js" ]]; then
    log "ecosystem.config.js already exists in repo — skipping generation"
    return
  fi

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
      env_file: '/var/www/psycrs/.env',
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
  deploy_nginx_config
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
