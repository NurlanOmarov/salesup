import { test, expect } from "@playwright/test";

test("главная страница отвечает и рендерит заголовок", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "SalesAcademy" })).toBeVisible();
});

test("health-эндпоинт сообщает статус БД", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.db).toBe("up");
});
