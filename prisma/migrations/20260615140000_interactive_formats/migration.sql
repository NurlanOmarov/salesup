-- Новые интерактивные форматы уроков (конструктор скрипта, «найди ошибку», hotspot).
ALTER TYPE "AiArtifactType" ADD VALUE IF NOT EXISTS 'SCRIPT_BUILDER';
ALTER TYPE "AiArtifactType" ADD VALUE IF NOT EXISTS 'DIALOGUE_AUDIT';
ALTER TYPE "AiArtifactType" ADD VALUE IF NOT EXISTS 'HOTSPOT';

-- Подкаст-формат: аудиодорожка, извлечённая фабрикой из видео урока.
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "audioKey" TEXT;
