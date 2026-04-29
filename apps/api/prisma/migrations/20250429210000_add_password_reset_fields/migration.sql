-- AlterTable
ALTER TABLE "users" ADD COLUMN "reset_token" TEXT;
ALTER TABLE "users" ADD COLUMN "reset_token_expires_at" TIMESTAMP(3);
 
-- CreateIndex
CREATE UNIQUE INDEX "users_reset_token_key" ON "users"("reset_token");