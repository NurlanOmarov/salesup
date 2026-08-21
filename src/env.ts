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
  // Куда падают уведомления о новых заявках с сайта. По умолчанию — почта владельца.
  LEADS_NOTIFY_EMAIL: z.string().email().default("omarov.nb@gmail.com"),

  // ── Магазин WooCommerce на activesales.by (docs/WOO-INTEGRATION.md) ──
  // Карту принимает эквайринг Альфа-Банка на белорусском домене; к нам приходит
  // только факт оплаты заказа, поэтому карточных секретов здесь нет.
  // Пусто → приём отключён: /api/payments/woo отвечает 503, доступы выдаёт админ.
  WOO_WEBHOOK_SECRET: z.string().optional(),
  /** Адрес магазина: строит ссылки «Купить» на витрине и базу REST для сверки. */
  WOO_STORE_URL: z.string().url().default("https://activesales.by"),
  // Ключи Woo REST API (права «Чтение») для ночной сверки заказов: webhook может
  // потеряться, сверка добирает оплаченные заказы. Пусто → сверка не запускается.
  WOO_CONSUMER_KEY: z.string().optional(),
  WOO_CONSUMER_SECRET: z.string().optional(),

  // ── Живые сессии с тренером через SABAK (docs/LIVE-SESSIONS-PLAN.md) ──
  // Выключено по умолчанию: пока у SABAK нет сервисных ключей, кабинет просто
  // не показывает раздел встреч, а не падает на каждом запросе.
  LIVE_SESSIONS_ENABLED: bool.default("false"),
  SABAK_BASE_URL: z.string().url().optional(),
  // Сервисный ключ (client_credentials) со скоупами lessons:write, lessons:read,
  // guests:issue, recordings:read. Выдаётся в /admin/api-clients на стороне SABAK.
  SABAK_CLIENT_ID: z.string().optional(),
  SABAK_CLIENT_SECRET: z.string().optional(),
  // Секрет исходящих вебхуков SABAK (docs/S2S_API.md §4). Пусто → приём
  // выключен: событиям без проверенной подписи верить нельзя.
  SABAK_WEBHOOK_SECRET: z.string().optional(),

  // Telegram-бот владельца: основной канал уведомлений о новых заявках.
  // Пусто → уведомления просто не отправляются (заявка всё равно в админке).
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
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
