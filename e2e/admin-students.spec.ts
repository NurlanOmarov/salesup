import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

/**
 * S5.1 AC: админ создаёт ученика и выдаёт доступ за минуту → ученик входит,
 * меняет временный пароль, получает доступ к курсу; отзыв доступа закрывает
 * видео немедленно; все действия пишутся в AdminLog.
 */

const db = new PrismaClient();

const OWNER_EMAIL = "e2e-owner@test.local";
const OWNER_PASS = "owner-e2e-pass-123";
const STUDENT_EMAIL = "e2e-newstudent@test.local";

let ownerId = "";
let paidLessonId = "";
let pharmaCourseId = "";

test.describe.configure({ mode: "serial" });
// Свой IP — изолированный rate-limit bucket (в e2e nginx нет, IP общий).
test.use({ extraHTTPHeaders: { "x-forwarded-for": "10.88.0.5" } });

test.beforeAll(async () => {
  await db.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, STUDENT_EMAIL] } } });

  const owner = await db.user.create({
    data: {
      email: OWNER_EMAIL,
      name: "E2E Владелец",
      role: "OWNER",
      passwordHash: await hashPassword(OWNER_PASS),
      mustChangePassword: false,
    },
  });
  ownerId = owner.id;

  // Платный опубликованный урок медпредов с реальным зашифрованным ключом —
  // чтобы проверить, что enrollment даёт доступ, а отзыв его закрывает.
  const intro = await db.lesson.findFirstOrThrow({
    where: { isFreePreview: true, videoStatus: "READY" },
    select: { videoKey: true, videoAesKeyEnc: true, module: { select: { courseId: true } } },
  });
  pharmaCourseId = intro.module.courseId;
  const someModule = await db.module.findFirstOrThrow({
    where: { courseId: pharmaCourseId },
    select: { id: true },
  });
  // Переиспользуем реальное медиа intro-урока (файлы на диске), но делаем урок
  // ПЛАТНЫМ (isFreePreview=false) — так доступ определяется enrollment'ом.
  const paid = await db.lesson.create({
    data: {
      moduleId: someModule.id,
      title: "E2E S5.1 платный урок",
      sortOrder: 998,
      status: "PUBLISHED",
      isFreePreview: false,
      videoStatus: "READY",
      videoKey: intro.videoKey,
      videoAesKeyEnc: intro.videoAesKeyEnc,
    },
  });
  paidLessonId = paid.id;
});

test.afterAll(async () => {
  await db.lesson.deleteMany({ where: { id: paidLessonId } });
  await db.adminLog.deleteMany({ where: { actorId: ownerId } });
  await db.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, STUDENT_EMAIL] } } });
  await db.$disconnect();
});

async function loginUI(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Логин или e-mail").fill(email);
  await page.getByLabel("Пароль").fill(password);
  await page.getByRole("button", { name: "Войти" }).click();
}

async function pageFetchStatus(page: Page, url: string): Promise<number> {
  return page.evaluate(async (u) => (await fetch(u)).status, url);
}

test("полный цикл: создание ученика+доступ → вход → смена пароля → доступ к видео", async ({ page }) => {
  // 1) Владелец создаёт ученика и выдаёт доступ к курсу медпредов
  await loginUI(page, OWNER_EMAIL, OWNER_PASS);
  await expect(page).toHaveURL(/\/app|\/admin/);

  await page.goto("/admin/students/new");
  await page.getByLabel("Имя (как в сертификате) *").fill("Айгерим Тест");
  await page.getByLabel("E-mail (логин) *").fill(STUDENT_EMAIL);
  await page
    .getByRole("checkbox", { name: /медицинских представителей/i })
    .check();
  await page.getByRole("button", { name: "Создать и выдать доступ" }).click();

  // 2) Перехватываем показанный один раз временный пароль
  await expect(page.getByText("Ученик создан")).toBeVisible();
  const tempPassword = (await page.locator("code").first().textContent())?.trim();
  expect(tempPassword).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);

  // Доступ к курсу выдан (Enrollment, source MANUAL)
  const enrollment = await db.enrollment.findFirstOrThrow({
    where: { user: { email: STUDENT_EMAIL }, courseId: pharmaCourseId },
  });
  expect(enrollment.source).toBe("MANUAL");
  expect(enrollment.revokedAt).toBeNull();

  // AdminLog зафиксировал создание и выдачу
  const createLog = await db.adminLog.findFirst({
    where: { actorId: ownerId, action: "student.create" },
  });
  expect(createLog).not.toBeNull();

  // 3) Владелец выходит; ученик входит выданным паролем → форс-смена пароля
  await page.goto("/login"); // залогинен owner → редирект на /app
  await page.context().clearCookies();

  await loginUI(page, STUDENT_EMAIL, tempPassword!);
  await expect(page).toHaveURL(/\/change-password/);

  const newPass = "student-new-pass-789";
  await page.getByLabel("Текущий (временный) пароль").fill(tempPassword!);
  await page.getByLabel("Новый пароль", { exact: true }).fill(newPass);
  await page.getByLabel("Повторите новый пароль").fill(newPass);
  await page.getByRole("checkbox", { name: /Я принимаю условия/ }).check(); // акцепт оферты при первом входе
  await page.getByRole("button", { name: "Сохранить и продолжить" }).click();
  await expect(page).toHaveURL(/\/app/);

  // 4) Ученик имеет доступ к платному уроку выданного курса (enrollment активен)
  expect(await pageFetchStatus(page, `/api/video/playlist/${paidLessonId}`)).toBe(200);
  expect(await pageFetchStatus(page, `/api/video/key/${paidLessonId}`)).toBe(200);
});

test("отзыв доступа закрывает видео немедленно", async ({ page }) => {
  // Ученик входит (пароль уже сменён в предыдущем тесте)
  await loginUI(page, STUDENT_EMAIL, "student-new-pass-789");
  await expect(page).toHaveURL(/\/app/);
  expect(await pageFetchStatus(page, `/api/video/playlist/${paidLessonId}`)).toBe(200);

  // Владелец отзывает доступ (через action-эффект — ставим revokedAt как делает revokeEnrollmentAction)
  await db.enrollment.updateMany({
    where: { user: { email: STUDENT_EMAIL }, courseId: pharmaCourseId },
    data: { revokedAt: new Date() },
  });

  // Доступ закрыт немедленно: playlist и key → 403
  expect(await pageFetchStatus(page, `/api/video/playlist/${paidLessonId}`)).toBe(403);
  expect(await pageFetchStatus(page, `/api/video/key/${paidLessonId}`)).toBe(403);
});
