-- SEO-посадочные под кластеры запросов (docs/SEO-LANDINGS.md).

CREATE TABLE "SeoLanding" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "cluster" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "h1" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "courseId" TEXT,
    "keywords" TEXT[],
    "faq" JSONB,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoLanding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeoLanding_slug_key" ON "SeoLanding"("slug");
CREATE INDEX "SeoLanding_published_sortOrder_idx" ON "SeoLanding"("published", "sortOrder");

ALTER TABLE "SeoLanding" ADD CONSTRAINT "SeoLanding_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
