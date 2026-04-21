# РОЛЬ

Ты senior backend инженер (Node.js, архитектура уровня production).
Пишешь чистый, безопасный и масштабируемый код.

Если видишь слабое место — улучши решение.

---

# КОНТЕКСТ

Проект уже создан как monorepo:

- apps/api — Fastify backend
- apps/web — Next.js
- packages/shared — общие типы

Сейчас мы реализуем backend core.

---

# РЕЖИМ РАБОТЫ

Работай по шагам.

На каждом шаге:
1. Структура файлов
2. Код

Минимум объяснений.

НЕ переходи к следующему шагу, пока текущий не завершён.

---

# ЦЕЛЬ

Реализовать:

1. Prisma schema (production-ready)
2. Базовую инфраструктуру backend (config, logger, server)
3. Auth систему (JWT + refresh tokens)
4. Middleware авторизации
5. Service слой

---

# ШАГ 1 — PRISMA SCHEMA

## Требования:

Реализуй модели:

### User
- id (uuid)
- email (unique)
- passwordHash
- createdAt

### Subscription
- id
- userId (FK)
- status (enum)
- currentPeriodEnd
- createdAt

### Lesson
- id
- title
- videoId
- createdAt

### VideoToken
- id
- userId
- tokenHash (НЕ хранить сырой токен)
- expiresAt

### WebhookLog
- id
- provider
- eventId (unique)
- processedAt

---

## Обязательно:
- связи (relations)
- индексы
- enum для SubscriptionStatus
- onDelete поведение (CASCADE где нужно)

---

## После schema:
- prisma client config
- пример env переменной DATABASE_URL

---

# ШАГ 2 — CONFIG + LOGGER

Создай:

## config/env.ts
- Zod схема
- валидация при старте
- типизированный env объект

## config/logger.ts
- Pino logger
- разные уровни для dev/prod

---

# ШАГ 3 — СТРУКТУРА BACKEND
apps/api/src/
server.ts
app.ts
routes/
controllers/
services/
middleware/
providers/
config/


---

## Требования:
- Fastify instance в app.ts
- server.ts только запускает сервер
- регистрация плагинов отдельно

---

# ШАГ 4 — AUTH SYSTEM

## Требования:

### JWT:
- accessToken (15 минут)
- refreshToken (7 дней)

### Refresh токены:
- хранятся в БД (хэш)
- можно инвалидировать

---

## Реализуй:

### AuthService:
- register(email, password)
- login(email, password)
- refreshTokens(refreshToken)
- logout(refreshToken)

---

## Безопасность:
- password hashing (bcrypt)
- refresh token rotation
- проверка reuse (защита от token theft)

---

# ШАГ 5 — AUTH MIDDLEWARE

Создай middleware:

### requireAuth
- проверяет accessToken
- кладёт user в request

---

# ШАГ 6 — ROUTES

Минимальные роуты:
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET /me


---

# ШАГ 7 — SERVICE LAYER ПРАВИЛА

- вся логика в services
- controllers только вызывают services
- никакой логики в routes

---

# КОД-СТАНДАРТЫ

- TypeScript strict
- никаких any
- async/await
- кастомные Error классы
- JSDoc для публичных методов

---

# ВАЖНО

- не делай упрощённый auth
- реализуй production-подход
- не используй "примерный код"

---

# СТАРТ

Начни с ШАГА 1 (Prisma schema).

Остановись после него.