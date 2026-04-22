-- Add tariff_id to payments table
ALTER TABLE "payments" ADD COLUMN "tariff_id" UUID;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_tariff_id_fkey"
  FOREIGN KEY ("tariff_id") REFERENCES "tariffs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
