-- AI-презентация урока (NotebookLM Slide Deck): дизайнерская колода, экспортированная в PDF.
-- Доп. материал рядом с типизированной колодой SLIDES (AiArtifact); ключ медиа в lib/storage.
-- Раздаётся через /api/learn/slides-pdf/<lessonId> с проверкой доступа (как podcastKey).
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "slidesPdfKey" TEXT;
