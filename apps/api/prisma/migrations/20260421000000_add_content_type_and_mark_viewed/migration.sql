-- Migration: add_content_type_and_mark_viewed
-- Created: 2026-04-21

-- 1. Create ContentType enum
CREATE TYPE "ContentType" AS ENUM ('lecture', 'affirmation', 'article_pdf');

-- 2. Add contentType and pdfUrl columns to lessons
ALTER TABLE "lessons"
    ADD COLUMN "content_type" "ContentType" NOT NULL DEFAULT 'lecture',
    ADD COLUMN "pdf_url"      TEXT;

-- 3. Add index on content_type for filtered queries
CREATE INDEX "lessons_content_type_idx" ON "lessons"("content_type");

-- 4. Add isMarkedViewed to progress
ALTER TABLE "progress"
    ADD COLUMN "is_marked_viewed" BOOLEAN NOT NULL DEFAULT false;
