import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

/**
 * S4.1 AC: прохождение теста с порогом и пересдачей. Также проверяем, что
 * правильные ответы не утекают в разметку до сдачи (оценка — на сервере).
 */

const db = new PrismaClient();

const EMAIL = "e2e-quiz@test.local";
const PASS = "quiz-pass-123";
let examId = "";

test.describe.configure({ mode: "serial" });
test.use({ extraHTTPHeaders: { "x-forwarded-for": "10.77.0.3" } });

test.beforeAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } });
  const user = await db.user.create({
    data: {
      email: EMAIL,
      name: "E2E Квиз",
      role: "STUDENT",
      passwordHash: await hashPassword(PASS),
      mustChangePassword: false,
    },
  });
  const exam = await db.quiz.findFirstOrThrow({
    where: { kind: "FINAL_EXAM", course: { slug: "sales-pharma" } },
    select: { id: true, courseId: true },
  });
  examId = exam.id;
  const courseId = exam.courseId!; // FINAL_EXAM всегда привязан к курсу
  await db.enrollment.upsert({
    where: { userId_courseId: { userId: user.id, courseId } },
    create: { userId: user.id, courseId, source: "MANUAL" },
    update: { revokedAt: null },
  });
});

test.afterAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } });
  await db.$disconnect();
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(EMAIL);
  await page.getByLabel("Пароль").fill(PASS);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/app/);
}

test("правильные ответы не присутствуют в разметке теста до сдачи", async ({ page }) => {
  await login(page);
  const res = await page.goto(`/app/quiz/${examId}`);
  const html = await res!.text();
  // Маркеры правильности не должны попадать на клиент.
  expect(html).not.toContain("isCorrect");
  expect(html).not.toContain("correctOptionIds");
});

test("провал по порогу → «Почти получилось» и доступна пересдача", async ({ page }) => {
  await login(page);
  await page.goto(`/app/quiz/${examId}`);

  const total = await db.question.count({ where: { quizId: examId, validation: "VALIDATED" } });

  // Универсальный проход по всем типам заданий заведомо неверными ответами:
  // FILL_BLANK — мусор в инпуты; choice — первый вариант; ORDERING — порядок как есть.
  for (let i = 0; i < total; i++) {
    await page.waitForTimeout(300); // дать AnimatePresence завершить переход
    const inputs = page.locator('input[type="text"], input:not([type])');
    const selects = page.locator("select");
    const categories = page.locator("[data-quiz-category]");
    const options = page.locator("[data-quiz-option]");
    if ((await inputs.count()) > 0) {
      const n = await inputs.count();
      for (let k = 0; k < n; k++) await inputs.nth(k).fill("неверно");
    } else if ((await selects.count()) > 0) {
      const n = await selects.count(); // MATCHING
      for (let k = 0; k < n; k++) await selects.nth(k).selectOption({ index: 1 });
    } else if ((await categories.count()) > 0) {
      const n = await categories.count(); // CATEGORIZATION — клик по каждой кнопке (категория проставится)
      for (let k = 0; k < n; k++) await categories.nth(k).click();
    } else if ((await options.count()) > 0) {
      await options.first().click(); // choice
    }
    // ORDERING: порядок уже задан, ответ заполнен автоматически — просто идём дальше.
    const finish = page.getByRole("button", { name: "Завершить" });
    if (await finish.isVisible().catch(() => false)) {
      await finish.click();
      break;
    }
    await page.getByRole("button", { name: "Далее" }).click();
  }

  await expect(page.getByText("Почти получилось")).toBeVisible();
  await expect(page.getByRole("button", { name: "Пройти заново" })).toBeVisible();

  const attempt = await db.quizAttempt.findFirst({
    where: { quizId: examId, user: { email: EMAIL } },
    orderBy: { finishedAt: "desc" },
  });
  expect(attempt?.status).toBe("FAILED");
});
