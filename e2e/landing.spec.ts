import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

test.afterAll(async () => {
  await db.lead.deleteMany({ where: { contact: { contains: "e2e-lead" } } });
  await db.$disconnect();
});

test("заявка с формы создаёт Lead в БД", async ({ page }) => {
  const contact = `+7 700 e2e-lead-${Date.now()}`;

  await page.goto("/");
  await page
    .getByRole("link", { name: "Подобрать курс под мою отрасль" })
    .click();

  // форма заявки в секции #zayavka
  await page.getByLabel("Имя").fill("E2E Заявка");
  await page.getByLabel(/Телефон, WhatsApp или e-mail/).fill(contact);
  await page.getByLabel("Комментарий").fill("Интересует курс по туризму");
  await page.getByRole("button", { name: "Оставить заявку" }).click();

  await expect(page.getByText("Заявка отправлена!")).toBeVisible();

  // проверяем, что запись появилась в БД (AC: «заявка появляется в админке»)
  await expect
    .poll(async () => db.lead.count({ where: { contact } }))
    .toBe(1);
});

test("публичные страницы оферты и политики доступны без входа", async ({
  page,
}) => {
  await page.goto("/offer");
  await expect(
    page.getByRole("heading", { name: "Публичная оферта" }),
  ).toBeVisible();

  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", { name: "Политика конфиденциальности" }),
  ).toBeVisible();
});
