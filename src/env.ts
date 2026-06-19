import { z } from "zod";

/**
 * Централизованная валидация переменных окружения (CLAUDE.md, правило 7).
 * Серверные секреты доступны только на сервере; клиентские — только с префиксом NEXT_PUBLIC_.
 * При невалидном env приложение падает на старте с понятной ошибкой, а не в рантайме.
 */

const bool = z
  .enum(["true", "false"])
  .transform((v) => v === "true");

const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(16),

  ANTHROPIC_API_KEY: z.string().min(1),
  // Ключ провайдера эмбеддингов. Сейчас — OpenAI (text-embedding-3-small, D-001).
  EMBEDDINGS_API_KEY: z.string().min(1),

  // Голосовой ролплей (STT/TTS через OpenAI). ⚠️ Отступление от «один сервер»:
  // голос ученика уходит на внешний сервис; голос — биометрия (ПДн РК) — поэтому
  // выключено по умолчанию, включать осознанно. OPENAI_API_KEY опционален: при
  // отсутствии используется EMBEDDINGS_API_KEY (тот же OpenAI-ключ).
  VOICE_ENABLED: bool.default("false"),
  OPENAI_API_KEY: z.string().optional(),

  // Говорящая 3D-голова AI-клиента в голосовом симуляторе (Three.js + GLB-аватар
  // из media/avatars/). Чисто клиентский рендер; требует VOICE_ENABLED. По умолчанию выкл.
  AVATAR_ENABLED: bool.default("false"),

  MEDIA_ROOT: z.string().min(1),
  STORAGE_DRIVER: z.enum(["fs", "s3"]).default("fs"),
  VIDEO_SIGNING_SECRET: z.string().min(16),
  VIDEO_KEY_ENC_SECRET: z.string().min(16),
  // true на VPS: сегменты отдаёт nginx через X-Accel-Redirect (internal location).
  // false в локальной разработке без nginx: сегмент стримится приложением напрямую.
  VIDEO_XACCEL: bool.default("false"),

  // true ТОЛЬКО на временном VPS по IP без TLS — снимает флаг Secure с cookie сессии.
  // На боевом домене с HTTPS обязан быть false (D-007). Используется в lib/auth (Sprint 1).
  AUTH_COOKIE_INSECURE: bool.default("false"),

  // S3 — только после миграции (драйвер s3), в MVP опциональны
  S3_ENDPOINT: z.string().url().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),

  EMAIL_ENABLED: bool.default("false"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  OWNER_EMAIL: z.string().email(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_SUPPORT_WHATSAPP: z.string().optional(),
  NEXT_PUBLIC_SUPPORT_TELEGRAM: z.string().optional(),
  NEXT_PUBLIC_SUPPORT_PHONE: z.string().optional(),
});

/**
 * NEXT_PUBLIC_* инлайнятся Next-ом на этапе сборки — нельзя читать их через
 * динамический доступ к process.env, поэтому перечисляем явно.
 */
const clientRaw = {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPPORT_WHATSAPP: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP,
  NEXT_PUBLIC_SUPPORT_TELEGRAM: process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM,
  NEXT_PUBLIC_SUPPORT_PHONE: process.env.NEXT_PUBLIC_SUPPORT_PHONE,
};

// На клиенте серверную схему не парсим (секретов там нет).
const isServer = typeof window === "undefined";

function formatErrors(error: z.ZodError): string {
  return error.issues
    .map((i) => `  ${i.path.join(".")}: ${i.message}`)
    .join("\n");
}

function buildEnv() {
  const client = clientSchema.safeParse(clientRaw);
  if (!client.success) {
    throw new Error(
      `❌ Невалидные публичные переменные окружения:\n${formatErrors(client.error)}`,
    );
  }

  if (!isServer) {
    return { ...client.data } as Env;
  }

  const server = serverSchema.safeParse(process.env);
  if (!server.success) {
    throw new Error(
      `❌ Невалидные серверные переменные окружения:\n${formatErrors(server.error)}`,
    );
  }

  return { ...server.data, ...client.data } as Env;
}

export type Env = z.infer<typeof serverSchema> & z.infer<typeof clientSchema>;

export const env = buildEnv();
