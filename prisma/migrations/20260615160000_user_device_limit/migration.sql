-- Настраиваемый лимит устройств на ученика: null = стандартный, 0 = безлимит, N = N устройств.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deviceLimit" INTEGER;
