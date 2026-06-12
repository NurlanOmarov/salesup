import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // e2e (Playwright) живут отдельно и запускаются через test:e2e
    exclude: ["node_modules", ".next", "e2e", "tests/e2e"],
  },
});
