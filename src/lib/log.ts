import pino from "pino";

/**
 * Логгер приложения (CLAUDE.md: pino, без Sentry в MVP).
 * ПДн не логируем (правило 9). В dev — pino-pretty, в prod — JSON в stdout
 * (docker logs / файл с ротацией на VPS).
 */
const isDev = process.env.NODE_ENV !== "production";

export const log = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  // редактируем потенциальные ПДн/секреты, если случайно попадут в объект лога
  redact: {
    paths: [
      "password",
      "passwordHash",
      "email",
      "phone",
      "*.password",
      "*.passwordHash",
      "*.email",
      "*.phone",
      "authorization",
      "*.authorization",
    ],
    censor: "[redacted]",
  },
  transport: isDev
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } }
    : undefined,
});
