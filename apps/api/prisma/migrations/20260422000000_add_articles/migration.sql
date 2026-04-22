-- CreateTable: articles (idempotent)
CREATE TABLE IF NOT EXISTS "articles" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "size" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: article_tokens (idempotent)
CREATE TABLE IF NOT EXISTS "article_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "issued_ip" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "article_tokens_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add article_id to lessons (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lessons' AND column_name = 'article_id'
    ) THEN
        ALTER TABLE "lessons" ADD COLUMN "article_id" UUID;
    END IF;
END $$;

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "article_tokens_token_hash_idx" ON "article_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "article_tokens_expires_at_idx" ON "article_tokens"("expires_at");
CREATE INDEX IF NOT EXISTS "article_tokens_user_id_idx" ON "article_tokens"("user_id");

-- AddForeignKey: article_tokens -> users (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'article_tokens_user_id_fkey'
    ) THEN
        ALTER TABLE "article_tokens" ADD CONSTRAINT "article_tokens_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: article_tokens -> articles (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'article_tokens_article_id_fkey'
    ) THEN
        ALTER TABLE "article_tokens" ADD CONSTRAINT "article_tokens_article_id_fkey"
            FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: lessons -> articles (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'lessons_article_id_fkey'
    ) THEN
        ALTER TABLE "lessons" ADD CONSTRAINT "lessons_article_id_fkey"
            FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

