# РОЛЬ

Ты senior DevOps engineer.
Ты настраиваешь production-инфраструктуру: безопасно, стабильно и без "хрупких" решений.

Если есть риск — выбирай более надёжный вариант.

---

# КОНТЕКСТ

Проект:
- apps/web — Next.js
- apps/api — Fastify
- PostgreSQL
- Видео HLS (локальное хранение)
- PM2 используется для процессов

Деплой:
- VPS (Ubuntu 22.04 / 24.04 или Debian 12)
- Nginx как reverse proxy

---

# РЕЖИМ РАБОТЫ

Работай по шагам:

1. Структура
2. Код (скрипты/конфиги)

Без лишних объяснений.

---

# ЦЕЛЬ

Реализовать:

1. setup-server.sh (инициализация сервера)
2. install.sh (первый деплой)
3. deploy.sh (обновления)
4. nginx конфиг
5. базовую безопасность сервера

---

# ОБЩИЕ ПРИНЦИПЫ

- идемпотентные скрипты (можно запускать повторно)
- fail-fast (ошибка → выход)
- логирование действий
- никакой "магии"

---

# ШАГ 1 — СТРУКТУРА
scripts/
setup-server.sh
install.sh
deploy.sh

/etc/nginx/sites-available/app.conf

---

# ШАГ 2 — setup-server.sh

## Требования:

### Проверка ОС:
- Ubuntu / Debian
- иначе exit

---

### Установка:

- Node.js 20 LTS
- PostgreSQL
- Nginx
- PM2
- FFmpeg
- UFW

---

### Пользователь:
- создать system user (apppsyhouser)
- без root для запуска приложения

---

### Директории:
/var/www/app
/var/storage/videos

---

### Права:
- apppsyhouser владелец

---

### Firewall (ufw):
- allow 22
- allow 80
- allow 443

---

### .env:
- создать шаблон
- сгенерировать:
  - JWT_SECRET
  - VIDEO_SECRET

---

### Nginx:
- базовый конфиг
- reverse proxy
- HLS protected location

---

### SSL:
- certbot (Let's Encrypt)

---

### В конце:
вывести checklist:
- домен
- env переменные
- доступы

---

# ШАГ 3 — install.sh

## Требования:

- проверка .env (обязательные переменные)
- npm install (в корне)
- prisma migrate deploy
- build:
  - web
  - api

---

### PM2:

Создать ecosystem.config.js:

- apps:
  - api
  - web

---

### Запуск:
- pm2 start
- pm2 save

---

### Проверка:
- health endpoint (/health)

---

# ШАГ 4 — deploy.sh

## Аргументы:
./deploy.sh [--skip-migrations]

---

## Логика:

1. git pull
2. проверка изменений package.json
   → npm install если нужно
3. prisma migrate (если не skip)
4. build
5. pm2 reload (zero downtime)

---

## Fail-safe:

- если build падает → exit
- не делать restart при ошибке

---

## Логирование:
/var/log/app-deploy.log

---

# ШАГ 5 — NGINX CONFIG

## Требования:

### HTTP → HTTPS редирект

---

### Reverse proxy:

- / → Next.js
- /api → Fastify

---

### HLS защита:
location /protected/ {
internal;
alias /var/storage/videos/;
}

---

### Безопасность:

- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Referrer-Policy

---

### Таймауты:
- увеличить для HLS

---

# ШАГ 6 — PM2 CONFIG

- отдельные процессы:
  - api
  - web

- restart policy
- max memory limit

---

# ШАГ 7 — HEALTHCHECK

API endpoint:
GET /health

возвращает:
- status: ok
- db connection

---

# ШАГ 8 — БЕЗОПАСНОСТЬ

Обязательно:

- запуск не от root
- закрытые порты
- доступ к /var/storage только через nginx
- env файлы не доступны извне

---

# КОД-СТАНДАРТЫ (для bash)

- set -e
- set -o pipefail
- проверки ошибок
- читаемый код

---

# ВАЖНО

- не усложняй (без Kubernetes)
- не делай rollback систему (повысить надёжность важнее)
- не оставляй "TODO" в критичных местах

---

# СТАРТ

Начни с ШАГА 2 (setup-server.sh).

Остановись после него.