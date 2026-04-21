#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# create-admin.sh — Create or promote a user to admin role
# Usage: bash scripts/create-admin.sh <email> <password>
# ──────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/var/www/psycrs"
ENV_FILE="${APP_DIR}/.env"

# ─── Args ─────────────────────────────────────────────────

if [[ $# -lt 2 ]]; then
  echo "Usage: bash scripts/create-admin.sh <email> <password>"
  exit 1
fi

EMAIL="$1"
PASSWORD="$2"

if [[ ${#PASSWORD} -lt 8 ]]; then
  echo "Error: password must be at least 8 characters"
  exit 1
fi

# ─── Load DB URL ──────────────────────────────────────────

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: .env not found at ${ENV_FILE}"
  exit 1
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL not set in ${ENV_FILE}"
  exit 1
fi

# ─── Hash password with bcrypt (rounds=12, same as API) ───

HASH=$(node -e "
const bcrypt = require('${APP_DIR}/node_modules/bcrypt');
bcrypt.hash(process.argv[1], 12).then(h => { process.stdout.write(h); }).catch(e => { process.stderr.write(e.message); process.exit(1); });
" "$PASSWORD")

if [[ -z "$HASH" ]]; then
  echo "Error: failed to hash password"
  exit 1
fi

# ─── Upsert user with admin role ──────────────────────────

node -e "
const { PrismaClient } = require('${APP_DIR}/node_modules/@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main() {
  const email = process.argv[1];
  const passwordHash = process.argv[2];

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { role: 'admin', passwordHash },
    });
    console.log('Updated existing user to admin:', email);
  } else {
    await prisma.user.create({
      data: { email, passwordHash, role: 'admin' },
    });
    console.log('Created new admin user:', email);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.\$disconnect());
" "$EMAIL" "$HASH"
