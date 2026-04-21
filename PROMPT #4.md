# РОЛЬ

Ты senior backend engineer (fintech / billing systems).
Ты строишь систему платежей, устойчивую к сбоям, дубликатам и race conditions.

Если решение небезопасно — исправь его.

---

# КОНТЕКСТ

Уже реализовано:
- Auth система
- Prisma
- Video system (доступ зависит от подписки)

Теперь реализуем платежи и подписки.

---

# РЕЖИМ РАБОТЫ

Работай по шагам:

1. Структура
2. Код

Без лишних объяснений.

---

# ЦЕЛЬ

Реализовать:

1. PaymentProvider abstraction
2. YooKassa integration
3. Subscription lifecycle
4. Webhook обработку (идемпотентную)
5. Retry логику платежей

---

# КРИТИЧЕСКИЕ ПРИНЦИПЫ

## 1. Webhooks — источник истины
- НЕ доверять frontend
- статус платежа только из webhook

## 2. Идемпотентность
- один webhook = одно изменение состояния
- повторные webhook НЕ ломают систему

## 3. Консистентность
- нельзя создать 2 активные подписки
- нельзя списать дважды

---

# ШАГ 1 — СТРУКТУРА
apps/api/src/
providers/payment/
PaymentProvider.ts
YookassaProvider.ts
services/
payment.service.ts
subscription.service.ts
routes/
payment.routes.ts
controllers/
payment.controller.ts

---

# ШАГ 2 — IPaymentProvider

Методы:

- createPayment(userId, amount)
- cancelPayment(paymentId)
- handleWebhook(payload)

---

# ШАГ 3 — YOOKASSA PROVIDER

## Требования:

- использование YooKassa API
- создание платежа (redirect confirmation)
- metadata: userId

---

## Важно:

- idempotence_key при создании платежа
- обработка статусов:
  - pending
  - succeeded
  - canceled

---

# ШАГ 4 — SUBSCRIPTION SERVICE

## Логика:

### При успешном платеже:
- создать или обновить подписку
- статус → active
- currentPeriodEnd → +30 дней

---

### При неудачном:
- статус → grace_period
- запуск retry логики

---

### Retry:
- максимум 3 попытки
- интервал 24 часа

---

## Важно:
- только 1 активная подписка на пользователя
- обновление атомарное (transaction)

---

# ШАГ 5 — WEBHOOK HANDLER (САМОЕ ВАЖНОЕ)

## Используй WebhookLog таблицу:

Проверка:
1. eventId уже обработан → игнор
2. если нет → обработать
3. сохранить eventId

---

## Обработка:

### payment.succeeded
→ активировать подписку

### payment.canceled
→ перевести в grace_period или expired

---

## Обязательно:
- транзакция
- логирование
- защита от race conditions

---

# ШАГ 6 — PAYMENT SERVICE

Методы:

- startSubscription(userId)
  → createPayment

- handleWebhook(event)
  → вызывает subscription.service

---

# ШАГ 7 — ROUTES
POST /payment/create
POST /payment/webhook
GET /subscription/status

---

# ШАГ 8 — БЕЗОПАСНОСТЬ

- проверка подписи webhook (если доступно)
- idempotency key
- никаких доверий frontend

---

# ШАГ 9 — ENV

Добавь:

- YOOKASSA_SHOP_ID
- YOOKASSA_SECRET_KEY
- YOOKASSA_WEBHOOK_SECRET

---

# КОД-СТАНДАРТЫ

- strict typing
- никаких any
- транзакции Prisma
- кастомные Error классы
- логирование через Pino

---

# ВАЖНО

- не делай упрощённую систему платежей
- не обновляй подписку вне webhook
- не игнорируй идемпотентность

---

# СТАРТ

Начни с ШАГА 1 (структура + PaymentProvider интерфейс).

Остановись после него.