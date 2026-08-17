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
  await page.getByLabel("Логин или e-mail").fill(FORCE_EMAIL);
  await page.getByLabel("Пароль").fill("temp-pass-123");
  await page.getByRole("button", { name: "Войти" }).click();

  // middleware перенаправляет на форс-смену пароля
  await expect(page).toHaveURL(/\/change-password/);

  await page.getByLabel("Текущий (временный) пароль").fill("temp-pass-123");
  await page.getByLabel("Новый пароль", { exact: true }).fill("new-strong-pass-456");
  await page.getByLabel("Повторите новый пароль").fill("new-strong-pass-456");
  // акцепт оферты и согласие на обработку ПДн — обязательная отметка при первом входе
  await page.getByRole("checkbox", { name: /Я принимаю условия/ }).check();
  await page.getByRole("button", { name: "Сохранить и продолжить" }).click();

  await expect(page).toHaveURL(/\/app/);
  await expect(
    page.getByRole("heading", { name: "Моё обучение" }),
  ).toBeVisible();

  // факт акцепта зафиксирован с версией редакции документов
  const accepted = await db.user.findUnique({ where: { email: FORCE_EMAIL } });
  expect(accepted?.termsAcceptedAt).not.toBeNull();
  expect(accepted?.termsVersion).toBeTruthy();
});

test("блокировка после серии неудачных попыток", async ({ page }) => {
  await createStudent(RL_EMAIL, "correct-pass-123", false);

  // 5 неудачных попыток — на каждой обычная ошибка пароля
  for (let i = 0; i < 5; i++) {
    await page.goto("/login");
    await page.getByLabel("Логин или e-mail").fill(RL_EMAIL);
    await page.getByLabel("Пароль").fill("wrong-pass");
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(
      // Вход принимает и e-mail, и логин работника организации — сообщение
      // об ошибке общее для обоих случаев.
      page.getByText("Неверный логин или пароль"),
    ).toBeVisible();
  }

  // 6-я попытка (даже с верным паролем) — блок
  await page.goto("/login");
  await page.getByLabel("Логин или e-mail").fill(RL_EMAIL);
  await page.getByLabel("Пароль").fill("correct-pass-123");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(
    page.getByText("Слишком много попыток"),
  ).toBeVisible();
});

test("саморегистрация недоступна (нет страницы регистрации)", async ({
  page,
}) => {
  // Публичной регистрации нет: /register отдаёт честный 404. Именно 404, а не
  // редирект на вход — неизвестные пути не уводятся на /login намеренно
  // (src/auth.config.ts: это ломало бы SEO и журнал битых ссылок).
  const res = await page.goto("/register");
  expect(res?.status()).toBe(404);

  // И на самой форме входа нет приглашения зарегистрироваться: учётки розничным
  // ученикам создаёт админ, работники организаций приходят по коду на /join.
  await page.goto("/login");
  await expect(page.getByText(/зарегистрироваться/i)).toHaveCount(0);
});

test("приватная зона требует входа", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
});
