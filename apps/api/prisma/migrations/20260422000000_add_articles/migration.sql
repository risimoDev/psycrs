-- CreateTable: articles
CREATE TABLE "articles" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "size" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: article_tokens
CREATE TABLE "article_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "issued_ip" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "article_tokens_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add article_id to lessons
ALTER TABLE "lessons" ADD COLUMN "article_id" UUID;

-- CreateIndex
CREATE INDEX "article_tokens_token_hash_idx" ON "article_tokens"("token_hash");
CREATE INDEX "article_tokens_expires_at_idx" ON "article_tokens"("expires_at");
CREATE INDEX "article_tokens_user_id_idx" ON "article_tokens"("user_id");

-- AddForeignKey: article_tokens -> users
ALTER TABLE "article_tokens" ADD CONSTRAINT "article_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: article_tokens -> articles
ALTER TABLE "article_tokens" ADD CONSTRAINT "article_tokens_article_id_fkey"
    FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: lessons -> articles
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_article_id_fkey"
    FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
