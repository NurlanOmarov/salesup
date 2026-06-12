import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.E2E_PORT ?? "3100";
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    // Полный набор (включая stateful auth-флоу) — на одном движке.
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Мобильная вёрстка 375px (CLAUDE.md / DoD): только stateless-проверки вёрстки,
    // чтобы не было гонок за общими данными и IP с chromium-прогоном.
    {
      name: "mobile",
      use: { ...devices["iPhone 13"] },
      testIgnore: ["**/auth.spec.ts"],
    },
  ],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
