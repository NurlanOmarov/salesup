import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const db = new PrismaClient();

// IP в e2e один на всех (нет nginx → "unknown"), поэтому rate-limit по IP может
// задеть соседние тесты — выполняем последовательно и чистим LoginAttempt до каждого.
test.describe.configure({ mode: "serial" });

const FORCE_EMAIL = "e2e-force@test.local";
const RL_EMAIL = "e2e-ratelimit@test.local";

async function createStudent(email: string, password: string, mustChange: boolean) {
  await db.user.deleteMany({ where: { email } });
  await db.user.create({
    data: {
      email,
      name: "E2E Студент",
      role: "STUDENT",
      passwordHash: await hashPassword(password),
      mustChangePassword: mustChange,
    },
  });
}

test.beforeEach(async () => {
  await db.loginAttempt.deleteMany({});
});

test.afterAll(async () => {
  await db.loginAttempt.deleteMany({});
  await db.user.deleteMany({ where: { email: { in: [FORCE_EMAIL, RL_EMAIL] } } });
  await db.$disconnect();
});

test("вход выданным паролем → форс-смена → кабинет", async ({ page }) => {
  await createStudent(FORCE_EMAIL, "temp-pass-123", true);

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(FORCE_EMAIL);
  await page.getByLabel("Пароль").fill("temp-pass-123");
  await page.getByRole("button", { name: "Войти" }).click();

  // middleware перенаправляет на форс-смену пароля
  await expect(page).toHaveURL(/\/change-password/);

  await page.getByLabel("Текущий (временный) пароль").fill("temp-pass-123");
  await page.getByLabel("Новый пароль", { exact: true }).fill("new-strong-pass-456");
  await page.getByLabel("Повторите новый пароль").fill("new-strong-pass-456");
  await page.getByRole("button", { name: "Сохранить и продолжить" }).click();

  await expect(page).toHaveURL(/\/app/);
  await expect(
    page.getByRole("heading", { name: "Личный кабинет" }),
  ).toBeVisible();
});

test("блокировка после серии неудачных попыток", async ({ page }) => {
  await createStudent(RL_EMAIL, "correct-pass-123", false);

  // 5 неудачных попыток — на каждой обычная ошибка пароля
  for (let i = 0; i < 5; i++) {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(RL_EMAIL);
    await page.getByLabel("Пароль").fill("wrong-pass");
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(
      page.getByText("Неверный e-mail или пароль"),
    ).toBeVisible();
  }

  // 6-я попытка (даже с верным паролем) — блок
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(RL_EMAIL);
  await page.getByLabel("Пароль").fill("correct-pass-123");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(
    page.getByText("Слишком много попыток"),
  ).toBeVisible();
});

test("саморегистрация недоступна (нет страницы регистрации)", async ({
  page,
}) => {
  // Нет публичного пути регистрации: /register уводит на вход, на форме входа
  // нет ссылки «зарегистрироваться» — учётки создаёт только админ.
  await page.goto("/register");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(/регистрац/i)).toHaveCount(0);
});

test("приватная зона требует входа", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
});
