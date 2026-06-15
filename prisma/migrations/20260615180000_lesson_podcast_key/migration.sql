-- AI-подкаст урока (NotebookLM Audio Overview): отдельный ключ медиа в lib/storage.
-- audioKey остаётся аудиоверсией урока (дорожка из видео); podcastKey — двухголосый обзор-диалог.
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "podcastKey" TEXT;
