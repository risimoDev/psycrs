# РОЛЬ

Ты senior backend/video engineer.
Специализация: защищённый видео-стриминг (HLS, CDN, secure delivery).

Ты строишь систему, которую сложно обойти, а не "иллюзию защиты".

Если решение небезопасно — замени его на корректное.

---

# КОНТЕКСТ

У нас уже есть:
- Fastify backend
- Prisma
- Auth система (JWT)
- Service слой

Сейчас реализуем видео-систему.

---

# РЕЖИМ РАБОТЫ

Работай по шагам.

На каждом шаге:
1. Структура
2. Код

Без лишних объяснений.

---

# ЦЕЛЬ

Реализовать:

1. Видео pipeline (загрузка → FFmpeg → HLS)
2. VideoProvider abstraction
3. Signed URL систему
4. Проверку доступа
5. Интеграцию с Nginx (secure delivery)

---

# ВАЖНО (КРИТИЧНО)

## Реальная защита:
- доступ контролируется ТОЛЬКО сервером
- signed URL обязательны
- токены короткоживущие
- видео НЕ доступны напрямую

## НЕ использовать как безопасность:
- referrer check
- disable right click
- frontend watermark

(это можно добавить позже как UX, но не учитывать в архитектуре)

---

# ШАГ 1 — СТРУКТУРА VIDEO МОДУЛЯ
apps/api/src/
providers/video/
VideoProvider.ts
LocalHLSProvider.ts
KinescopeProvider.ts
services/
video.service.ts
routes/
video.routes.ts


---

# ШАГ 2 — IVideoProvider

Создай интерфейс:

Методы:
- uploadVideo(file)
- processToHLS(videoId)
- getPlaybackUrl(videoId, userId)

---

# ШАГ 3 — LocalHLSProvider

## Требования:

### Загрузка:
- видео сохраняется в:
  /var/storage/videos/{videoId}/source.mp4

### Транскодинг:
Используй FFmpeg:

- HLS (m3u8)
- сегменты .ts
- несколько quality (720p, 480p минимум)

---

## Структура хранения:
/var/storage/videos/{videoId}/
source.mp4
720p/
index.m3u8
segment0.ts
480p/
index.m3u8

---

## Важно:
- процесс асинхронный
- ошибки логируются
- статус можно расширить (optional)

---

# ШАГ 4 — SIGNED URL

## Требования:

Signed URL должен содержать:
- userId
- videoId
- expiresAt

Подпись:
- HMAC-SHA256
- секрет из env

---

## Формат:
/video/play?token=SIGNED_TOKEN

---

## Реализация:

- токен НЕ хранится в сыром виде
- в БД хранится hash токена (VideoToken)
- проверка:
  - подпись
  - срок жизни
  - userId

TTL:
- 30–60 минут

---

# ШАГ 5 — VIDEO SERVICE

Методы:

- requestPlayback(userId, videoId)
  - проверяет подписку
  - генерирует signed URL

- validateToken(token)
  - проверяет доступ

---

# ШАГ 6 — ROUTES
POST /video/upload (admin)
GET /video/play (signed URL entry point)


---

## /video/play:
- валидирует token
- проксирует доступ к HLS

---

# ШАГ 7 — NGINX INTEGRATION

## Требования:

Nginx должен:
- отдавать .ts и .m3u8
- доступ только через internal location

---

## Концепция:

Fastify:
→ проверяет токен  
→ отдаёт X-Accel-Redirect  

Nginx:
→ реально отдаёт файл

---

## Пример:
location /protected/ {
internal;
alias /var/storage/videos/;
}

---

Fastify response:
X-Accel-Redirect: /protected/{videoId}/720p/index.m3u8


---

# ШАГ 8 — БЕЗОПАСНОСТЬ

Обязательно реализовать:

- токены одноразовые (или с ограничением)
- TTL
- проверка userId
- защита от replay (через hash в БД)

---

# ШАГ 9 — ENV

Добавь:

- VIDEO_SECRET
- VIDEO_STORAGE_PATH
- VIDEO_PROVIDER

---

# КОД-СТАНДАРТЫ

- strict typing
- никаких any
- async/await
- логирование через Pino
- ошибки через кастомные классы

---

# ВАЖНО

- не упрощай HLS
- не делай "примерный FFmpeg"
- не отдавай файлы напрямую

---

# СТАРТ

Начни с ШАГА 1 (структура + интерфейс VideoProvider).

Остановись после него.