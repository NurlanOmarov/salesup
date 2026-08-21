import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Серверные модули (lib/live, lib/seo) начинаются с import "server-only";
      // в Node-окружении тестов пакет бросает ошибку, поэтому подменяем пустышкой.
      "server-only": fileURLToPath(
        new URL("./src/test/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.{test,spec}.{ts,tsx}", "scripts/**/*.{test,spec}.ts"],
    // e2e (Playwright) живут отдельно и запускаются через test:e2e
    exclude: ["node_modules", ".next", "e2e", "tests/e2e"],
    // Фиктивный env: некоторые модули импортируют src/env.ts (zod-валидация при импорте).
    // Реальные сервисы в unit-тестах не вызываются — значения нужны лишь для прохождения схемы.
    env: {
      DATABASE_URL: "postgresql://u:p@localhost:5432/db",
      AUTH_SECRET: "test_secret_at_least_16_chars",
      ANTHROPIC_API_KEY: "test-dummy",
      EMBEDDINGS_API_KEY: "test-dummy",
      MEDIA_ROOT: "/tmp/media",
      VIDEO_SIGNING_SECRET: "test_secret_at_least_16",
      VIDEO_KEY_ENC_SECRET: "test_secret_at_least_16",
      OWNER_EMAIL: "owner@example.kz",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    },
  },
});
