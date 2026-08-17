import { test, expect } from "@playwright/test";

test("лендинг отвечает и рендерит hero + бренд", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "ACTIVE SALES" })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 1,
      // Заголовок правится в src/content/landing.ts — держим шаблон широким,
      // чтобы смоук ловил падение страницы, а не переформулировку оффера.
      name: /продаж/i,
    }),
  ).toBeVisible();
});

test("health-эндпоинт сообщает статус БД", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.db).toBe("up");
});
