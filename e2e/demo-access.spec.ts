import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

/**
 * Демо-доступ: ученику открыт процент курса, остальное закрыто пейволлом.
 *
 * Проверяем именно серверную границу, а не вид страницы: закрытый урок должен
 * отдавать 403 на playlist, ключ AES и субтитры — иначе «демо» обходится прямой
 * ссылкой на API. Плюс тест закрытого урока (дыра, из-за которой задание урока
 * за границей открывалось напрямую) и экран пейволла вместо 404.
 */

const db = new PrismaClient();

const EMAIL = "e2e-demo@test.local";
const PASS = "demo-pass-123";
const COURSE_SLUG = "e2e-demo-course";

let userId = "";
let courseId = "";
let openLessonId = "";
let closedLessonId = "";
let closedQuizId = "";

test.describe.configure({ mode: "serial" });
test.use({ extraHTTPHeaders: { "x-forwarded-for": "10.99.0.11" } });

test.beforeAll(async () => {
  await db.course.deleteMany({ where: { slug: COURSE_SLUG } });
  await db.user.deleteMany({ where: { email: EMAIL } });

  const user = await db.user.create({
    data: {
      email: EMAIL,
      name: "E2E Демо",
      role: "STUDENT",
      passwordHash: await hashPassword(PASS),
      mustChangePassword: false,
    },
    select: { id: true },
  });
  userId = user.id;

  // Курс из 4 уроков: при 30% открыт ровно один (floor(4 × 0.3) = 1).
  const course = await db.course.create({
    data: {
      slug: COURSE_SLUG,
      title: "E2E демо-курс",
      description: "Фикстура демо-доступа",
      priceTiyn: 10000,
      status: "PUBLISHED",
      modules: {
        create: {
          title: "Модуль 1",
          sortOrder: 0,
          lessons: {
            create: [0, 1, 2, 3].map((i) => ({
              title: `Урок ${i + 1}`,
              sortOrder: i,
              status: "PUBLISHED" as const,
            })),
          },
        },
      },
    },
    select: {
      id: true,
      modules: { select: { lessons: { orderBy: { sortOrder: "asc" }, select: { id: true } } } },
    },
  });
  courseId = course.id;
  const lessons = course.modules[0]!.lessons;
  openLessonId = lessons[0]!.id;
  closedLessonId = lessons[1]!.id;

  const quiz = await db.quiz.create({
    data: {
      kind: "LESSON_QUIZ",
      lessonId: closedLessonId,
      title: "Задание закрытого урока",
      status: "PUBLISHED",
      passScore: 70,
    },
    select: { id: true },
  });
  closedQuizId = quiz.id;

  await db.enrollment.create({
    data: {
      userId,
      courseId,
      source: "MANUAL",
      startsAt: new Date(),
      demoPercent: 30,
    },
  });
});

test.afterAll(async () => {
  await db.course.deleteMany({ where: { slug: COURSE_SLUG } });
  await db.user.deleteMany({ where: { email: EMAIL } });
  await db.$disconnect();
});

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Логин или e-mail").fill(EMAIL);
  await page.getByLabel("Пароль").fill(PASS);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/app/);
}

async function status(page: import("@playwright/test").Page, url: string): Promise<number> {
  return page.evaluate(async (u) => (await fetch(u)).status, url);
}

test("урок за границей демо: playlist, ключ и субтитры → 403", async ({ page }) => {
  await login(page);

  expect(await status(page, `/api/video/playlist/${closedLessonId}`)).toBe(403);
  expect(await status(page, `/api/video/key/${closedLessonId}`)).toBe(403);
  expect(await status(page, `/api/video/subtitle/${closedLessonId}/RU`)).toBe(403);
  expect(await status(page, `/api/learn/material/${closedLessonId}?type=summary`)).toBe(403);
});

test("открытая часть курса остаётся доступной", async ({ page }) => {
  await login(page);
  // Видео у фикстуры нет (videoStatus NONE), поэтому проверяем именно отсутствие
  // отказа по доступу: 403 здесь означал бы, что демо режет и оплаченную часть.
  expect(await status(page, `/api/video/playlist/${openLessonId}`)).not.toBe(403);
});

test("тест закрытого урока не открывается прямой ссылкой", async ({ page }) => {
  await login(page);
  await page.goto(`/app/quiz/${closedQuizId}`);
  // Next отдаёт notFound() как страницу «404», HTTP-код при этом бывает 200 —
  // проверяем то, что видит ученик: теста нет, вопросы не показаны.
  await expect(page.getByText("Задание закрытого урока")).toHaveCount(0);
  await expect(page.locator("body")).toContainText("404");
});

test("закрытый урок показывает пейволл, а не 404", async ({ page }) => {
  await login(page);
  await page.goto(`/app/learn/${COURSE_SLUG}/${closedLessonId}`);
  await expect(page.getByRole("heading", { name: "Дальше — после оплаты" })).toBeVisible();
  await expect(page.getByText("1 из 4 уроков")).toBeVisible();
});

test("снятие демо открывает курс целиком", async ({ page }) => {
  await db.enrollment.update({
    where: { userId_courseId: { userId, courseId } },
    data: { demoPercent: null },
  });
  await login(page);
  expect(await status(page, `/api/video/playlist/${closedLessonId}`)).not.toBe(403);
  expect(await status(page, `/api/video/key/${closedLessonId}`)).not.toBe(403);

  await db.enrollment.update({
    where: { userId_courseId: { userId, courseId } },
    data: { demoPercent: 30 },
  });
});

/**
 * Управляющий путь владельца: демо-доступ виден и меняется прямо в реестре
 * клиентов (/admin/orgs) — без захода в карточку каждой компании. Значение
 * применяется ко всем лицензиям клиента сразу.
 */
test("владелец переключает демо клиента прямо в списке организаций", async ({ page }) => {
  // Прошлый прогон мог упасть до очистки — фикстура должна пересоздаваться.
  await db.orgLicense.deleteMany({ where: { org: { slug: "e2e-demo-org" } } });
  await db.organization.deleteMany({ where: { slug: "e2e-demo-org" } });
  await db.user.deleteMany({ where: { email: "e2e-demo-owner@test.local" } });

  const owner = await db.user.create({
    data: {
      email: "e2e-demo-owner@test.local",
      name: "E2E Владелец",
      role: "OWNER",
      passwordHash: await hashPassword("demo-owner-pass-123"),
      mustChangePassword: false,
    },
    select: { id: true },
  });
  const org = await db.organization.create({
    data: { slug: "e2e-demo-org", name: "ООО Демо-реестр" },
    select: { id: true },
  });
  await db.orgLicense.create({
    data: { orgId: org.id, courseId, seatsTotal: 1, demoPercent: 30 },
  });

  await page.goto("/login");
  await page.getByLabel("Логин или e-mail").fill("e2e-demo-owner@test.local");
  await page.getByLabel("Пароль").fill("demo-owner-pass-123");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/(app|admin)/);
  await page.goto("/admin/orgs");
  await expect(page.getByRole("heading", { name: "Организации" })).toBeVisible();

  const row = page.getByRole("row").filter({ hasText: "ООО Демо-реестр" });
  const select = row.getByLabel("Демо-доступ компании");
  await expect(select).toHaveValue("30");

  // Оплатили — открываем полностью одним выбором.
  await select.selectOption("");
  await expect
    .poll(async () => {
      const license = await db.orgLicense.findFirstOrThrow({
        where: { orgId: org.id },
        select: { demoPercent: true },
      });
      return license.demoPercent;
    })
    .toBeNull();

  await db.orgLicense.deleteMany({ where: { orgId: org.id } });
  await db.organization.deleteMany({ where: { id: org.id } });
  await db.adminLog.deleteMany({ where: { actorId: owner.id } });
  await db.user.deleteMany({ where: { id: owner.id } });
});
