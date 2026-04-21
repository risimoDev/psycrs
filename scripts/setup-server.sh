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
APP_DIR="/var/www/psycrs"
DOMAIN="risimobzkdev.ru"
STORAGE_DIR="/var/storage/videos"
ENV_FILE="${APP_DIR}/.env"
LOG_FILE="/var/log/psycrs-setup.log"
NGINX_CONF="/etc/nginx/sites-available/psycrs.conf"
NODE_MAJOR=20
GIT_REPO="git@github.com:YOUR_GITHUB_USER/psycrs.git"  # <-- update before running

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
  mkdir -p /var/log/psycrs

  chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"
  chown -R "${APP_USER}:${APP_USER}" "$STORAGE_DIR"
  chown -R "${APP_USER}:${APP_USER}" /var/log/psycrs
  chmod 750 "$APP_DIR"
  chmod 750 "$STORAGE_DIR"
  chmod 750 /var/log/psycrs

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

generate_password() {
  # URL-safe 24-char password (no special chars that break connection strings)
  openssl rand -base64 18 | tr -d '+/=' | head -c 24
}

# ─── .env — Fully Auto-generated ─────────────────────────

create_env_template() {
  if [[ -f "$ENV_FILE" ]]; then
    log ".env already exists at ${ENV_FILE} — skipping"
    return
  fi

  log "Auto-generating .env with all secrets..."

  local jwt_secret jwt_refresh_secret video_secret webhook_secret db_password
  jwt_secret=$(generate_secret)
  jwt_refresh_secret=$(generate_secret)
  video_secret=$(generate_secret)
  webhook_secret=$(generate_secret)
  db_password=$(generate_password)

  cat > "$ENV_FILE" <<EOF
# ─── Database ──────────────────────────────────────────────
DATABASE_URL="postgresql://psycrs:${db_password}@localhost:5432/psycrs?schema=public"

# ─── Server ────────────────────────────────────────────────
PORT=4000
HOST=127.0.0.1
NODE_ENV=production
LOG_LEVEL=info
CORS_ORIGIN=https://${DOMAIN}

# ─── Auth ──────────────────────────────────────────────────
JWT_SECRET=${jwt_secret}
JWT_REFRESH_SECRET=${jwt_refresh_secret}

# ─── Video ─────────────────────────────────────────────────
VIDEO_PROVIDER=local
VIDEO_SIGNING_SECRET=${video_secret}
VIDEO_STORAGE_PATH=${STORAGE_DIR}
VIDEO_TOKEN_TTL_MINUTES=60

# ─── Storage ──────────────────────────────────────────────
STORAGE_PROVIDER=local
# S3_ENDPOINT=https://storage.yandexcloud.net
# S3_REGION=ru-central1
# S3_BUCKET=psycrs-videos
# S3_ACCESS_KEY_ID=
# S3_SECRET_ACCESS_KEY=

# ─── CDN (optional) ───────────────────────────────────────
# CDN_URL=https://cdn.${DOMAIN}

# ─── Payment (YooKassa) ───────────────────────────────────
# FILL THESE IN from your YooKassa dashboard:
YOOKASSA_SHOP_ID=FILL_ME
YOOKASSA_SECRET_KEY=FILL_ME
YOOKASSA_WEBHOOK_SECRET=${webhook_secret}
PAYMENT_RETURN_URL=https://${DOMAIN}/payment/result
SUBSCRIPTION_PRICE=2990

# ─── Frontend (baked into JS bundle at build time) ────────
NEXT_PUBLIC_API_URL=https://${DOMAIN}
NEXT_PUBLIC_SITE_URL=https://${DOMAIN}
EOF

  # Save DB password separately for setup_database to read
  echo "$db_password" > "${APP_DIR}/.db_password"
  chmod 600 "${APP_DIR}/.db_password"

  chown "${APP_USER}:${APP_USER}" "$ENV_FILE"
  chmod 600 "$ENV_FILE"

  log ".env auto-generated at ${ENV_FILE}"
  log "Only YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY need manual filling"
}

# ─── PostgreSQL DB + User ─────────────────────────────────

setup_database() {
  local db_exists
  db_exists=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='psycrs'" 2>/dev/null || true)

  if [[ "$db_exists" == "1" ]]; then
    log "Database 'psycrs' already exists — skipping"
    return
  fi

  log "Creating PostgreSQL database and user 'psycrs'..."

  # Read password that was written by create_env_template
  local db_password
  if [[ -f "${APP_DIR}/.db_password" ]]; then
    db_password=$(cat "${APP_DIR}/.db_password")
  else
    # Fallback: extract from DATABASE_URL in .env
    db_password=$(grep -oP '(?<=psycrs:)[^@]+' "$ENV_FILE" | head -1)
  fi

  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'psycrs') THEN
    CREATE ROLE psycrs WITH LOGIN PASSWORD '${db_password}';
  END IF;
END
\$\$;

CREATE DATABASE psycrs OWNER psycrs;
GRANT ALL PRIVILEGES ON DATABASE psycrs TO psycrs;
SQL

  # Remove temp password file
  rm -f "${APP_DIR}/.db_password"

  log "Database 'psycrs' created (user: psycrs, password stored in .env)"
}

# ─── Nginx Config ─────────────────────────────────────────

configure_nginx() {
  log "Configuring Nginx for ${DOMAIN}..."

  cat > "$NGINX_CONF" <<NGINX
# ──────────────────────────────────────────────────────────
# PsyCRS — Nginx Configuration
# Domain: ${DOMAIN}
# ──────────────────────────────────────────────────────────

# HTTP → HTTPS redirect + ACME challenge
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};

    # SSL — populated by certbot
    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # ─── Security Headers ─────────────────────────────────
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    client_max_body_size 500m;

    # ─── API (Fastify :4000) ──────────────────────────────
    location /api/ {
        proxy_pass http://127.0.0.1:4000/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # ─── HLS Protected (X-Accel-Redirect from API) ────────
    location /protected/ {
        internal;
        alias /var/storage/videos/;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Access-Control-Allow-Origin "\$scheme://\$host" always;
        send_timeout 60s;
        sendfile on;
        tcp_nopush on;
        aio on;
        types {
            application/vnd.apple.mpegurl m3u8;
            video/mp2t ts;
        }
    }

    location ~* \.ts$ {
        add_header Cache-Control "public, max-age=604800, immutable" always;
    }
    location ~* \.m3u8$ {
        add_header Cache-Control "public, max-age=5, must-revalidate" always;
    }

    # ─── Next.js frontend (:3000) ─────────────────────────
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    location ~ /\. { deny all; return 404; }

    access_log /var/log/nginx/psycrs-access.log;
    error_log  /var/log/nginx/psycrs-error.log warn;
}
NGINX

  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/psycrs.conf
  rm -f /etc/nginx/sites-enabled/default

  # Test with HTTP-only config first (SSL certs don't exist yet)
  # Temporarily comment out SSL lines for initial test
  local tmp_conf
  tmp_conf=$(mktemp)
  sed '/ssl_certificate\|ssl_dhparam\|options-ssl/s/^/# /' "$NGINX_CONF" > "$tmp_conf"
  if nginx -t -c "$tmp_conf" 2>/dev/null; then
    rm "$tmp_conf"
  else
    rm "$tmp_conf"
    log "WARNING: Nginx config will be valid after certbot runs — skipping reload for now"
    return
  fi

  systemctl reload nginx 2>/dev/null || true
  log "Nginx configured for ${DOMAIN}"
}

# ─── PM2 Startup ──────────────────────────────────────────

configure_pm2_startup() {
  log "Configuring PM2 startup..."
  pm2 startup systemd -u "$APP_USER" --hp "/home/${APP_USER}" --service-name pm2-psycrs || true
  log "PM2 startup configured for ${APP_USER}"
}

# ─── Clone Repository ─────────────────────────────────────

clone_repo() {
  if [[ -d "${APP_DIR}/.git" ]]; then
    log "Repository already cloned at ${APP_DIR} — skipping"
    return
  fi

  if [[ "$GIT_REPO" == *"YOUR_GITHUB_USER"* ]]; then
    log "WARNING: GIT_REPO not set — skipping clone."
    log "After setup, run: git clone <repo-url> ${APP_DIR}"
    return
  fi

  log "Cloning repository ${GIT_REPO} → ${APP_DIR}..."
  git clone "$GIT_REPO" "$APP_DIR"
  chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"
  log "Repository cloned"
}

# ─── SSL Certificate ──────────────────────────────────────

obtain_ssl() {
  if [[ -d "/etc/letsencrypt/live/${DOMAIN}" ]]; then
    log "SSL certificate for ${DOMAIN} already exists — skipping"
    return
  fi

  # Check that domain resolves to this server
  local server_ip
  server_ip=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
  local domain_ip
  domain_ip=$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)

  if [[ -z "$domain_ip" ]]; then
    log "WARNING: ${DOMAIN} does not resolve yet — skipping SSL."
    log "After DNS propagates run: certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
    return
  fi

  if [[ "$server_ip" != "$domain_ip" ]]; then
    log "WARNING: ${DOMAIN} resolves to ${domain_ip}, server IP is ${server_ip} — skipping SSL."
    log "Point DNS A record to ${server_ip}, then run:"
    log "  certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
    return
  fi

  log "Obtaining SSL certificate for ${DOMAIN}..."
  certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email \
    -d "$DOMAIN" -d "www.${DOMAIN}" && \
    log "SSL certificate obtained for ${DOMAIN}" || \
    log "WARNING: certbot failed — run manually: certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
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

# ─── Print Summary ────────────────────────────────────────

print_summary() {
  # Count remaining manual items
  local yookassa_filled
  yookassa_filled=$(grep -c "FILL_ME" "$ENV_FILE" 2>/dev/null || echo "2")

  local ssl_status="✓ obtained"
  [[ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]] && ssl_status="✗ pending (DNS not ready)"

  local repo_status="✓ cloned"
  [[ ! -d "${APP_DIR}/.git" ]] && repo_status="✗ pending (GIT_REPO not set)"

  cat <<EOF

═══════════════════════════════════════════════════════════
  SETUP COMPLETE — ${DOMAIN}
═══════════════════════════════════════════════════════════

  Auto-configured:
    ✓ Node.js ${NODE_MAJOR}, PostgreSQL, Nginx, PM2, FFmpeg, Certbot
    ✓ System user: ${APP_USER}
    ✓ Directories: ${APP_DIR}, ${STORAGE_DIR}
    ✓ Firewall: ports 22, 80, 443
    ✓ Database: psycrs (credentials in .env)
    ✓ All secrets/passwords auto-generated
    ✓ Nginx: ${NGINX_CONF}
    Repository: ${repo_status}
    SSL:        ${ssl_status}

  ─── Only manual action needed ───────────────────────────

$(if [[ "$yookassa_filled" -gt 0 ]]; then
cat <<INNER
  [ ] Fill in YooKassa credentials in ${ENV_FILE}:
      nano ${ENV_FILE}
        YOOKASSA_SHOP_ID=<from dashboard>
        YOOKASSA_SECRET_KEY=<from dashboard>
INNER
fi)
$(if [[ ! -d "${APP_DIR}/.git" ]]; then
cat <<INNER
  [ ] Clone the repository:
      git clone <your-repo-url> ${APP_DIR}
      chown -R ${APP_USER}:${APP_USER} ${APP_DIR}
INNER
fi)
$(if [[ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]]; then
cat <<INNER
  [ ] Point DNS A record to this server IP, then:
      certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}
INNER
fi)
  [ ] Run first deploy:
      bash ${APP_DIR}/scripts/install.sh

  ─── Useful commands ──────────────────────────────────────
    pm2 status              — process status
    pm2 logs                — live logs
    bash ${APP_DIR}/scripts/deploy.sh  — deploy new version
    cat ${ENV_FILE}         — view generated secrets

  Env file: ${ENV_FILE}
  Log:      ${LOG_FILE}

═══════════════════════════════════════════════════════════

EOF
}

# ─── Main ─────────────────────────────────────────────────

main() {
  log "═══ Starting server setup for ${DOMAIN} ═══"

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

  # .env and DB must come before clone (clone needs the dir to exist)
  create_env_template
  setup_database

  clone_repo
  configure_nginx
  configure_pm2_startup
  obtain_ssl

  log "═══ Server setup complete ═══"
  print_summary
}

main "$@"
