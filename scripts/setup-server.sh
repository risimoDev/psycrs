#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# setup-server.sh — One-time server initialization
# Idempotent: safe to re-run
# Tested on: Ubuntu 22.04 / 24.04, Debian 12
# ──────────────────────────────────────────────────────────
set -euo pipefail
IFS=$'\n\t'

# ─── Constants ────────────────────────────────────────────

APP_USER="apppsyhouser"
APP_DIR="/var/www/app"
STORAGE_DIR="/var/storage/videos"
ENV_FILE="${APP_DIR}/.env"
LOG_FILE="/var/log/app-setup.log"
NGINX_CONF="/etc/nginx/sites-available/app.conf"
NODE_MAJOR=20

# ─── Helpers ──────────────────────────────────────────────

log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
err()  { log "ERROR: $*" >&2; }
die()  { err "$*"; exit 1; }

check_root() {
  if [[ $EUID -ne 0 ]]; then
    die "This script must be run as root (use sudo)"
  fi
}

# ─── OS Detection ─────────────────────────────────────────

check_os() {
  if [[ ! -f /etc/os-release ]]; then
    die "Cannot detect OS — /etc/os-release not found"
  fi

  # shellcheck source=/dev/null
  source /etc/os-release

  case "${ID}" in
    ubuntu|debian)
      log "Detected OS: ${PRETTY_NAME}"
      ;;
    *)
      die "Unsupported OS: ${ID}. Only Ubuntu and Debian are supported."
      ;;
  esac
}

# ─── System Update ────────────────────────────────────────

update_system() {
  log "Updating system packages..."
  apt-get update -qq
  apt-get upgrade -y -qq
  apt-get install -y -qq \
    curl \
    gnupg \
    ca-certificates \
    lsb-release \
    git \
    build-essential \
    software-properties-common \
    apt-transport-https
  log "System packages updated"
}

# ─── Node.js 20 LTS ──────────────────────────────────────

install_node() {
  if command -v node &>/dev/null; then
    local current_major
    current_major=$(node -v | cut -d. -f1 | tr -d 'v')
    if [[ "$current_major" -ge "$NODE_MAJOR" ]]; then
      log "Node.js $(node -v) already installed — skipping"
      return
    fi
  fi

  log "Installing Node.js ${NODE_MAJOR}.x..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
  log "Node.js $(node -v) installed, npm $(npm -v)"
}

# ─── PostgreSQL ───────────────────────────────────────────

install_postgres() {
  if command -v psql &>/dev/null; then
    log "PostgreSQL already installed — skipping"
    return
  fi

  log "Installing PostgreSQL..."
  apt-get install -y -qq postgresql postgresql-contrib
  systemctl enable postgresql
  systemctl start postgresql
  log "PostgreSQL installed and running"
}

# ─── Nginx ────────────────────────────────────────────────

install_nginx() {
  if command -v nginx &>/dev/null; then
    log "Nginx already installed — skipping"
    return
  fi

  log "Installing Nginx..."
  apt-get install -y -qq nginx
  systemctl enable nginx
  log "Nginx installed"
}

# ─── FFmpeg ───────────────────────────────────────────────

install_ffmpeg() {
  if command -v ffmpeg &>/dev/null; then
    log "FFmpeg already installed — skipping"
    return
  fi

  log "Installing FFmpeg..."
  apt-get install -y -qq ffmpeg
  log "FFmpeg $(ffmpeg -version | head -1) installed"
}

# ─── PM2 ──────────────────────────────────────────────────

install_pm2() {
  if command -v pm2 &>/dev/null; then
    log "PM2 already installed — skipping"
    return
  fi

  log "Installing PM2..."
  npm install -g pm2
  log "PM2 $(pm2 -v) installed"
}

# ─── Certbot ──────────────────────────────────────────────

install_certbot() {
  if command -v certbot &>/dev/null; then
    log "Certbot already installed — skipping"
    return
  fi

  log "Installing Certbot..."
  apt-get install -y -qq certbot python3-certbot-nginx
  log "Certbot installed"
}

# ─── System User ──────────────────────────────────────────

create_app_user() {
  if id "$APP_USER" &>/dev/null; then
    log "User ${APP_USER} already exists — skipping"
    return
  fi

  log "Creating system user ${APP_USER}..."
  useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
  log "User ${APP_USER} created"
}

# ─── Directories ──────────────────────────────────────────

create_directories() {
  log "Creating application directories..."

  mkdir -p "$APP_DIR"
  mkdir -p "$STORAGE_DIR"
  mkdir -p /var/log/app

  chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"
  chown -R "${APP_USER}:${APP_USER}" "$STORAGE_DIR"
  chown -R "${APP_USER}:${APP_USER}" /var/log/app
  chmod 750 "$APP_DIR"
  chmod 750 "$STORAGE_DIR"
  chmod 750 /var/log/app

  log "Directories created: ${APP_DIR}, ${STORAGE_DIR}, /var/log/app"
}

# ─── Firewall ─────────────────────────────────────────────

configure_firewall() {
  log "Configuring UFW firewall..."

  if ! command -v ufw &>/dev/null; then
    apt-get install -y -qq ufw
  fi

  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp comment 'SSH'
  ufw allow 80/tcp comment 'HTTP'
  ufw allow 443/tcp comment 'HTTPS'

  # Enable non-interactively if not already active
  if ! ufw status | grep -q "Status: active"; then
    ufw --force enable
  fi

  log "Firewall configured (22, 80, 443 open)"
}

# ─── Generate Secrets ─────────────────────────────────────

generate_secret() {
  openssl rand -hex 32
}

# ─── .env Template ────────────────────────────────────────

create_env_template() {
  if [[ -f "$ENV_FILE" ]]; then
    log ".env already exists at ${ENV_FILE} — skipping (manual edit required)"
    return
  fi

  local jwt_secret
  local jwt_refresh_secret
  local video_secret
  jwt_secret=$(generate_secret)
  jwt_refresh_secret=$(generate_secret)
  video_secret=$(generate_secret)

  log "Generating .env template..."

  cat > "$ENV_FILE" <<EOF
# ─── Database ──────────────────────────────────────────────
DATABASE_URL="postgresql://psyhocourse:CHANGE_DB_PASSWORD@localhost:5432/psyhocourse?schema=public"

# ─── Server ────────────────────────────────────────────────
PORT=4000
HOST=127.0.0.1
NODE_ENV=production
LOG_LEVEL=info
CORS_ORIGIN=https://CHANGE_YOUR_DOMAIN

# ─── Auth ──────────────────────────────────────────────────
JWT_SECRET=${jwt_secret}
JWT_REFRESH_SECRET=${jwt_refresh_secret}

# ─── Video ─────────────────────────────────────────────────
VIDEO_PROVIDER=local
VIDEO_SIGNING_SECRET=${video_secret}
VIDEO_STORAGE_PATH=${STORAGE_DIR}
VIDEO_TOKEN_TTL_MINUTES=60

# ─── Storage (local | s3) ─────────────────────────────────
STORAGE_PROVIDER=local
# S3_ENDPOINT=https://storage.yandexcloud.net
# S3_REGION=ru-central1
# S3_BUCKET=psyhocourse-videos
# S3_ACCESS_KEY_ID=CHANGE_ME
# S3_SECRET_ACCESS_KEY=CHANGE_ME

# ─── CDN (optional — set when ready to scale) ─────────────
# CDN_URL=https://cdn.your-domain.com

# ─── Payment (YooKassa) ───────────────────────────────────
YOOKASSA_SHOP_ID=CHANGE_ME
YOOKASSA_SECRET_KEY=CHANGE_ME
YOOKASSA_WEBHOOK_SECRET=CHANGE_ME
PAYMENT_RETURN_URL=https://CHANGE_YOUR_DOMAIN/payment/result
SUBSCRIPTION_PRICE=2990
EOF

  chown "${APP_USER}:${APP_USER}" "$ENV_FILE"
  chmod 600 "$ENV_FILE"

  log ".env created at ${ENV_FILE} (secrets auto-generated, edit remaining values)"
}

# ─── PostgreSQL DB + User ─────────────────────────────────

setup_database() {
  local db_exists
  db_exists=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='psyhocourse'" 2>/dev/null || true)

  if [[ "$db_exists" == "1" ]]; then
    log "Database 'psyhocourse' already exists — skipping"
    return
  fi

  log "Creating PostgreSQL database and user..."

  local db_password
  db_password=$(generate_secret)

  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'psyhocourse') THEN
    CREATE ROLE psyhocourse WITH LOGIN PASSWORD '${db_password}';
  END IF;
END
\$\$;

CREATE DATABASE psyhocourse OWNER psyhocourse;
GRANT ALL PRIVILEGES ON DATABASE psyhocourse TO psyhocourse;
SQL

  # Update DATABASE_URL in .env with the actual password
  if [[ -f "$ENV_FILE" ]]; then
    sed -i "s/CHANGE_DB_PASSWORD/${db_password}/" "$ENV_FILE"
    log "DATABASE_URL updated in .env with generated password"
  fi

  log "Database 'psyhocourse' created (user: psyhocourse)"
  log "DB password saved to .env — store it securely"
}

# ─── Nginx Config ─────────────────────────────────────────

configure_nginx() {
  log "Configuring Nginx..."

  cat > "$NGINX_CONF" <<'NGINX'
# ──────────────────────────────────────────────────────────
# PsyhoCourse — Nginx Configuration
# ──────────────────────────────────────────────────────────

# HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name _;

    # SSL (managed by certbot — placeholders until cert is obtained)
    # ssl_certificate /etc/letsencrypt/live/DOMAIN/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/DOMAIN/privkey.pem;
    # include /etc/letsencrypt/options-ssl-nginx.conf;
    # ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # ─── Security Headers ─────────────────────────────────
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # ─── Limits ────────────────────────────────────────────
    client_max_body_size 500m;

    # ─── API (Fastify) ────────────────────────────────────
    location /api/ {
        proxy_pass http://127.0.0.1:4000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        # Disable buffering for webhook responses
        proxy_buffering off;
    }

    # ─── HLS Protected (internal only) ────────────────────
    # Served via X-Accel-Redirect from Fastify after token validation
    location /protected/ {
        internal;
        alias /var/storage/videos/;

        # X-Content-Type-Options for all
        add_header X-Content-Type-Options "nosniff" always;

        # CORS for HLS.js
        add_header Access-Control-Allow-Origin "$scheme://$host" always;

        # Extended timeouts for large segments
        send_timeout 60s;

        # Efficient file serving
        sendfile on;
        tcp_nopush on;
        aio on;

        # MIME types for HLS
        types {
            application/vnd.apple.mpegurl m3u8;
            video/mp2t ts;
        }
    }

    # CDN-friendly cache headers for HLS segments
    # .ts segments — immutable VOD content, cache 7 days
    location ~* \.ts$ {
        add_header Cache-Control "public, max-age=604800, immutable" always;
    }

    # .m3u8 playlists — short cache, may change during processing
    location ~* \.m3u8$ {
        add_header Cache-Control "public, max-age=5, must-revalidate" always;
    }

    # ─── Frontend (Next.js) ───────────────────────────────
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # ─── Block dotfiles ───────────────────────────────────
    location ~ /\. {
        deny all;
        return 404;
    }

    # ─── Block direct access to storage ───────────────────
    location /var/storage/ {
        deny all;
        return 404;
    }

    access_log /var/log/nginx/app-access.log;
    error_log  /var/log/nginx/app-error.log warn;
}
NGINX

  # Enable site
  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/app.conf

  # Remove default site if it exists
  rm -f /etc/nginx/sites-enabled/default

  # Test config
  if nginx -t 2>/dev/null; then
    systemctl reload nginx
    log "Nginx configured and reloaded"
  else
    err "Nginx config test failed — check ${NGINX_CONF}"
    nginx -t
  fi
}

# ─── PM2 Startup ──────────────────────────────────────────

configure_pm2_startup() {
  log "Configuring PM2 startup..."

  # Generate startup script for the app user
  pm2 startup systemd -u "$APP_USER" --hp "/home/${APP_USER}" --service-name pm2-app || true

  log "PM2 startup configured for ${APP_USER}"
}

# ─── Kernel Tuning (minimal) ──────────────────────────────

tune_kernel() {
  local sysctl_conf="/etc/sysctl.d/99-app.conf"

  if [[ -f "$sysctl_conf" ]]; then
    log "Kernel tuning already applied — skipping"
    return
  fi

  log "Applying minimal kernel tuning..."

  cat > "$sysctl_conf" <<EOF
# Connection handling
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535

# Keepalive
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_intvl = 30
net.ipv4.tcp_keepalive_probes = 5

# File descriptors
fs.file-max = 1048576

# Prevent IP spoofing
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Disable ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0

# Disable source routing
net.ipv4.conf.all.accept_source_route = 0
EOF

  sysctl --system >/dev/null

  log "Kernel tuning applied"
}

# ─── Print Checklist ──────────────────────────────────────

print_checklist() {
  cat <<EOF

═══════════════════════════════════════════════════════════
  SERVER SETUP COMPLETE
═══════════════════════════════════════════════════════════

  Checklist — manual actions required:

  [ ] 1. Point your domain DNS A record to this server IP
  [ ] 2. Edit ${ENV_FILE}:
         - Set CORS_ORIGIN to https://your-domain.com
         - Set PAYMENT_RETURN_URL
         - Set YOOKASSA_SHOP_ID, SECRET_KEY, WEBHOOK_SECRET
  [ ] 3. Obtain SSL certificate:
         sudo certbot --nginx -d your-domain.com
  [ ] 4. Update Nginx server_name in ${NGINX_CONF}
  [ ] 5. Clone the repo to ${APP_DIR}:
         sudo -u ${APP_USER} git clone <repo-url> ${APP_DIR}
  [ ] 6. Copy .env into the repo:
         cp ${ENV_FILE} ${APP_DIR}/apps/api/.env
  [ ] 7. Run install.sh:
         sudo -u ${APP_USER} ${APP_DIR}/scripts/install.sh

  System user:  ${APP_USER}
  App directory: ${APP_DIR}
  Storage:       ${STORAGE_DIR}
  Nginx config:  ${NGINX_CONF}
  Env file:      ${ENV_FILE}
  Deploy log:    /var/log/app-deploy.log

═══════════════════════════════════════════════════════════

EOF
}

# ─── Main ─────────────────────────────────────────────────

main() {
  log "═══ Starting server setup ═══"

  check_root
  check_os
  update_system

  install_node
  install_postgres
  install_nginx
  install_ffmpeg
  install_pm2
  install_certbot

  create_app_user
  create_directories

  configure_firewall
  tune_kernel

  create_env_template
  setup_database
  configure_nginx
  configure_pm2_startup

  log "═══ Server setup complete ═══"
  print_checklist
}

main "$@"
