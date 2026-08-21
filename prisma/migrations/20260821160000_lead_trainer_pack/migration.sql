-- Пакет с живыми сессиями тренера в корпоративной заявке (lib/pricing TRAINER_PACK).
ALTER TABLE "Lead" ADD COLUMN "withTrainer" BOOLEAN NOT NULL DEFAULT false;
