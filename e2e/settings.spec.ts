import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";

/**
 * S4.3: ученик меняет профиль (имя «как в сертификате») и пароль из кабинета.
 */

const db = new PrismaClient();

const EMAIL = "e2e-settings@test.local";
const PASS = "settings-pass-123";

test.describe.configure({ mode: "serial" });
test.use({ extraHTTPHeaders: { "x-forwarded-for": "10.66.0.2" } });

test.beforeAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } });
  await db.user.create({
    data: {
      email: EMAIL,
      name: "Старое Имя",
      role: "STUDENT",
      passwordHash: await hashPassword(PASS),
      mustChangePassword: false,
    },
  });
});

test.afterAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } });
  await db.$disconnect();
});

async function login(page: Page, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(EMAIL);
  await page.getByLabel("Пароль").fill(password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/app/);
}

test("обновление имени для сертификата сохраняется", async ({ page }) => {
  await login(page, PASS);
  await page.goto("/app/settings");

  await page.getByLabel("Имя (как в сертификате) *").fill("Новое Имя Сертификат");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Сохранено")).toBeVisible();

  const user = await db.user.findUniqueOrThrow({ where: { email: EMAIL }, select: { name: true } });
  expect(user.name).toBe("Новое Имя Сертификат");
});

test("смена пароля: неверный текущий → ошибка", async ({ page }) => {
  await login(page, PASS);
  await page.goto("/app/settings");

  await page.getByLabel("Текущий пароль").fill("wrong-current");
  await page.getByLabel("Новый пароль").fill("brand-new-pass-1");
  await page.getByLabel("Повторите новый").fill("brand-new-pass-1");
  await page.getByRole("button", { name: "Сменить пароль" }).click();

  await expect(page.getByText("Текущий пароль неверен")).toBeVisible();
});

test("смена пароля: верный текущий → пароль изменён в БД", async ({ page }) => {
  await login(page, PASS);
  await page.goto("/app/settings");

  const newPass = "fresh-strong-pass-9";
  await page.getByLabel("Текущий пароль").fill(PASS);
  await page.getByLabel("Новый пароль").fill(newPass);
  await page.getByLabel("Повторите новый").fill(newPass);
  await page.getByRole("button", { name: "Сменить пароль" }).click();
  await expect(page.getByText("Пароль изменён")).toBeVisible();

  const user = await db.user.findUniqueOrThrow({ where: { email: EMAIL }, select: { passwordHash: true } });
  expect(await verifyPassword(user.passwordHash!, newPass)).toBe(true);
});
