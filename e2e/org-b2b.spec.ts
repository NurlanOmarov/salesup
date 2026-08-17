import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

/**
 * B2B (docs/B2B-PLAN.md §7): владелец заводит организацию и лицензию, ответственный
 * представитель создаёт код, работник регистрируется сам — без единого ПДн, — и
 * получает доступ к курсу. Проверяем и запреты: чужая организация, повторное
 * использование кода, заморозка, отзыв места.
 */

const db = new PrismaClient();

const OWNER_EMAIL = "e2e-b2b-owner@test.local";
const OWNER_PASS = "owner-b2b-pass-123";
const ADMIN_EMAIL = "e2e-b2b-hr@test.local";
const ADMIN_PASS = "hr-b2b-pass-123";
const WORKER_PASS = "worker-b2b-pass-123";
const ORG_SLUG = "e2eorg";
const OTHER_ORG_SLUG = "e2eother";

let ownerId = "";
let orgId = "";
let otherOrgId = "";
let licenseId = "";
let courseId = "";
let paidLessonId = "";

test.describe.configure({ mode: "serial" });
// Один прогон на всю БД: сценарий создаёт записи с уникальными e-mail и slug,
// поэтому параллельный запуск во втором проекте падал бы на unique-констрейнте.
// Адаптивность здесь не проверяется — вьюпорт роли не играет.
test.skip(
  () => test.info().project.name !== "chromium",
  "сценарий выполняется один раз, в проекте chromium",
);
test.use({ extraHTTPHeaders: { "x-forwarded-for": "10.88.0.9" } });

test.beforeAll(async () => {
  await cleanup();

  const owner = await db.user.create({
    data: {
      email: OWNER_EMAIL,
      name: "E2E Владелец B2B",
      role: "OWNER",
      passwordHash: await hashPassword(OWNER_PASS),
      mustChangePassword: false,
    },
  });
  ownerId = owner.id;

  // Платный урок на реальном медиа — доступ к нему определяется местом в лицензии.
  const intro = await db.lesson.findFirstOrThrow({
    where: { isFreePreview: true, videoStatus: "READY" },
    select: { videoKey: true, videoAesKeyEnc: true, module: { select: { id: true, courseId: true } } },
  });
  courseId = intro.module.courseId;
  const paid = await db.lesson.create({
    data: {
      moduleId: intro.module.id,
      title: "E2E B2B платный урок",
      sortOrder: 997,
      status: "PUBLISHED",
      isFreePreview: false,
      videoStatus: "READY",
      videoKey: intro.videoKey,
      videoAesKeyEnc: intro.videoAesKeyEnc,
    },
  });
  paidLessonId = paid.id;

  // Вторая организация — чтобы проверить изоляцию кабинетов.
  const other = await db.organization.create({
    data: { name: "E2E Чужая компания", slug: OTHER_ORG_SLUG },
  });
  otherOrgId = other.id;
});

test.afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

async function cleanup() {
  if (paidLessonId) await db.lesson.deleteMany({ where: { id: paidLessonId } });
  const orgs = await db.organization.findMany({
    where: { slug: { in: [ORG_SLUG, OTHER_ORG_SLUG] } },
    select: { id: true, memberships: { select: { userId: true } } },
  });
  const memberUserIds = orgs.flatMap((o) => o.memberships.map((m) => m.userId));
  await db.organization.deleteMany({ where: { slug: { in: [ORG_SLUG, OTHER_ORG_SLUG] } } });
  if (memberUserIds.length) {
    await db.user.deleteMany({ where: { id: { in: memberUserIds } } });
  }
  await db.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, ADMIN_EMAIL] } } });
  // Сценарий логинится десятки раз с одного IP: без очистки срабатывает защита
  // от перебора и вход перестаёт проходить (rate-limit по IP и идентификатору).
  await db.loginAttempt.deleteMany({ where: { ip: "10.88.0.9" } });
  if (ownerId) await db.adminLog.deleteMany({ where: { actorId: ownerId } });
}

/**
 * Статус запроса из контекста страницы: page.request идёт мимо cookies сессии,
 * поэтому приватные API отвечали бы 401 даже вошедшему пользователю.
 */
async function pageFetchStatus(page: Page, url: string): Promise<number> {
  return page.evaluate(async (u) => (await fetch(u)).status, url);
}

async function login(page: Page, identity: string, password: string) {
  // Сценарий последовательно меняет пользователей. Одного сброса cookies мало:
  // клиентский роутер Next отдаёт закешированную навигацию прежнего пользователя,
  // поэтому сначала уходим на about:blank и только затем на форму входа.
  await page.context().clearCookies();
  await page.goto("about:blank");
  await page.goto("/login");
  await page.getByLabel("Логин или e-mail").fill(identity);
  await page.getByLabel("Пароль").fill(password);
  await page.getByRole("button", { name: "Войти" }).click();
  // Дожидаемся ухода со страницы входа: без этого следующий goto уходит раньше,
  // чем установится сессия, и приватная страница отвечает редиректом на /login.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15_000,
  });
}

test("владелец заводит организацию, лицензию и ответственного представителя", async ({
  page,
}) => {
  await login(page, OWNER_EMAIL, OWNER_PASS);
  await expect(page).toHaveURL(/\/admin/);

  await page.goto("/admin/orgs/new");
  await page.getByLabel("Наименование организации *").fill("E2E Тестовая компания");
  await page.getByLabel("Код организации").fill(ORG_SLUG);
  await page.getByRole("button", { name: "Создать организацию" }).click();

  // Ждём именно карточку организации: `new` тоже подходит под [a-z0-9]+, и с
  // широким шаблоном проверка проходила бы до создания записи.
  await expect(page).toHaveURL(/\/admin\/orgs\/(?!new)[a-z0-9]+$/);
  const org = await db.organization.findUniqueOrThrow({ where: { slug: ORG_SLUG } });
  orgId = org.id;

  // Лицензия: 2 места на тестовый курс. Курс выбираем явно — по умолчанию форма
  // подставляет первый опубликованный, и лицензия ушла бы не на тот курс.
  await page.getByLabel("Курс").selectOption(courseId);
  await page.getByLabel("Мест", { exact: true }).fill("2");
  await page.getByRole("button", { name: /Выдать лицензию/ }).click();
  // Ждём саму запись, а не текст: «Мест занято» есть на странице всегда, и
  // проверка по нему проходила бы до того, как действие успеет отработать.
  await expect
    .poll(() => db.orgLicense.count({ where: { orgId } }), { timeout: 15_000 })
    .toBe(1);

  const license = await db.orgLicense.findFirstOrThrow({ where: { orgId } });
  licenseId = license.id;
  expect(license.seatsTotal).toBe(2);

  // Ответственный представитель.
  await page.getByLabel("E-mail *").fill(ADMIN_EMAIL);
  await page.getByRole("button", { name: /Назначить ответственного/ }).click();
  await expect(page.getByText("Ответственный назначен")).toBeVisible();

  // Пароль назначаем известный — временный виден только в UI один раз.
  const admin = await db.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
  await db.user.update({
    where: { id: admin.id },
    data: { passwordHash: await hashPassword(ADMIN_PASS), mustChangePassword: false },
  });

  const membership = await db.orgMembership.findFirstOrThrow({
    where: { orgId, userId: admin.id },
  });
  expect(membership.role).toBe("ORG_ADMIN");
});

test("работник регистрируется по коду без единого персонального данного", async ({
  page,
}) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASS);

  await page.goto(`/org/${orgId}/invites`);
  await page.getByLabel("Сколько кодов").fill("1");
  await page.getByRole("button", { name: "Создать коды" }).click();
  await expect(page.getByText(/Готово: 1/)).toBeVisible();

  const invite = await db.orgInvite.findFirstOrThrow({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  // Регистрация работника — отдельный контекст, без сессии ответственного.
  await page.context().clearCookies();
  await page.goto(`/join?code=${invite.code}`);
  await page.getByLabel("Придумайте пароль").fill(WORKER_PASS);
  await page.getByLabel("Повторите пароль").fill(WORKER_PASS);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Начать обучение" }).click();

  await expect(page.getByText("Доступ открыт")).toBeVisible();
  await expect(page.getByText(`${ORG_SLUG}-0001`)).toBeVisible();

  // Ключевая проверка обезличивания: учётка без e-mail, имени и телефона.
  const worker = await db.user.findUniqueOrThrow({
    where: { login: `${ORG_SLUG}-0001` },
  });
  expect(worker.email).toBeNull();
  expect(worker.name).toBeNull();
  expect(worker.phone).toBeNull();

  // Место выдано из лицензии — доступ обычным Enrollment (правило 1).
  const enrollment = await db.enrollment.findFirstOrThrow({
    where: { userId: worker.id, courseId },
  });
  expect(enrollment.licenseId).toBe(licenseId);
  expect(enrollment.source).toBe("B2B");
  expect(enrollment.revokedAt).toBeNull();

  // Доступ к платному уроку реально работает. Проверяем по ключу AES: он живёт
  // в БД, тогда как playlist читает файл с диска — без медиа он вернул бы 404
  // и скрыл бы настоящий результат проверки прав.
  const res = await pageFetchStatus(page, `/api/video/key/${paidLessonId}`);
  expect(res).toBe(200);
});

test("код одноразовый: повторная регистрация отклоняется", async ({ page }) => {
  const invite = await db.orgInvite.findFirstOrThrow({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  await page.context().clearCookies();
  await page.goto(`/join?code=${invite.code}`);
  await page.getByLabel("Придумайте пароль").fill("another-pass-123");
  await page.getByLabel("Повторите пароль").fill("another-pass-123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Начать обучение" }).click();

  await expect(page.getByText(/Код больше не действует/)).toBeVisible();
});

test("ответственный не может открыть кабинет чужой организации", async ({ page }) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASS);

  // Прямой заход по чужому id: layout проверяет членство в БД, а не токен.
  await page.goto(`/org/${otherOrgId}`);
  await expect(page).not.toHaveURL(new RegExp(otherOrgId));
});

test("работник не попадает в кабинет организации", async ({ page }) => {
  await login(page, `${ORG_SLUG}-0001`, WORKER_PASS);
  await page.goto(`/org/${orgId}`);
  await expect(page).toHaveURL(/\/app/);
});

test("заморозка организации закрывает доступ, возобновление — возвращает", async ({
  page,
}) => {
  const { syncOrgAccess } = await import("../src/lib/org/sync");

  await db.organization.update({ where: { id: orgId }, data: { status: "SUSPENDED" } });
  await syncOrgAccess(orgId);

  await login(page, `${ORG_SLUG}-0001`, WORKER_PASS);
  const denied = await pageFetchStatus(page, `/api/video/playlist/${paidLessonId}`);
  expect(denied).toBe(403);

  await db.organization.update({ where: { id: orgId }, data: { status: "ACTIVE" } });
  await syncOrgAccess(orgId);

  const restored = await pageFetchStatus(page, `/api/video/key/${paidLessonId}`);
  expect(restored).toBe(200);
});

test("отзыв места освобождает его в пуле лицензии", async ({ page }) => {
  const worker = await db.user.findUniqueOrThrow({
    where: { login: `${ORG_SLUG}-0001` },
  });
  const before = await db.enrollment.count({
    where: { licenseId, revokedAt: null },
  });
  expect(before).toBe(1);

  await login(page, ADMIN_EMAIL, ADMIN_PASS);
  await page.goto(`/org/${orgId}/employees`);
  await expect(page.getByText(`${ORG_SLUG}-0001`)).toBeVisible();

  const { revokeSeat } = await import("../src/lib/org/service");
  const enrollment = await db.enrollment.findFirstOrThrow({
    where: { userId: worker.id, licenseId },
  });
  await revokeSeat({ orgId, enrollmentId: enrollment.id });

  const after = await db.enrollment.count({ where: { licenseId, revokedAt: null } });
  expect(after).toBe(0);

  // Доступ к уроку закрылся сразу.
  await login(page, `${ORG_SLUG}-0001`, WORKER_PASS);
  const res = await pageFetchStatus(page, `/api/video/playlist/${paidLessonId}`);
  expect(res).toBe(403);
});
