-- Create enum for promo code types
CREATE TYPE "PromoCodeType" AS ENUM ('fixed', 'percent', 'trial');

-- Create promo_codes table
CREATE TABLE "promo_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "type" "PromoCodeType" NOT NULL,
    "value" INTEGER NOT NULL,
    "max_uses" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "promo_codes_code_key" UNIQUE ("code")
);

CREATE INDEX "promo_codes_code_idx" ON "promo_codes"("code");
CREATE INDEX "promo_codes_is_active_idx" ON "promo_codes"("is_active");

-- Add promo code and trial fields to payments
ALTER TABLE "payments" ADD COLUMN "original_amount" DECIMAL(10,2);
ALTER TABLE "payments" ADD COLUMN "is_trial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payments" ADD COLUMN "promo_code_id" UUID;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_promo_code_id_fkey"
  FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Add trial and saved payment method fields to subscriptions
ALTER TABLE "subscriptions" ADD COLUMN "is_trial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscriptions" ADD COLUMN "trial_ends_at" TIMESTAMPTZ;
ALTER TABLE "subscriptions" ADD COLUMN "saved_payment_method_id" TEXT;

CREATE INDEX "subscriptions_trial_ends_at_idx" ON "subscriptions"("trial_ends_at");
