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
const LEAD_CONTACT = "e2e-b2b-lead@test.local";

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
    // Донор медиа: любой урок с готовым видео. Раньше искали бесплатный, но
    // бесплатных уроков в каталоге больше нет — фикстура падала на пустом поиске.
    where: { videoStatus: "READY" },
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
  await db.lead.deleteMany({ where: { contact: LEAD_CONTACT } });
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

  // Повторное назначение существующей учётки не трогает её пароль. Пока трогало,
  // владелец платформы, указавший в этой форме собственный e-mail, терял вход в
  // свою же консоль: пароль молча заменялся временным и показывался один раз.
  const hashBefore = (
    await db.user.findUniqueOrThrow({ where: { id: admin.id }, select: { passwordHash: true } })
  ).passwordHash;
  await page.getByRole("button", { name: "Готово" }).click();
  await page.getByLabel("E-mail *").fill(ADMIN_EMAIL);
  await page.getByRole("button", { name: /Назначить ответственного/ }).click();
  await expect(page.getByText("Учётная запись с таким e-mail уже была")).toBeVisible();
  await expect(page.getByText("Временный пароль")).toBeHidden();
  const hashAfter = (
    await db.user.findUniqueOrThrow({ where: { id: admin.id }, select: { passwordHash: true } })
  ).passwordHash;
  expect(hashAfter).toBe(hashBefore);

  // И собственную учётку владельца в представители не отдаём вовсе.
  await page.getByRole("button", { name: "Готово" }).click();
  await page.getByLabel("E-mail *").fill(OWNER_EMAIL);
  await page.getByRole("button", { name: /Назначить ответственного/ }).click();
  await expect(page.getByText("учётная запись владельца платформы", { exact: false })).toBeVisible();
});

test("корпоративная заявка ведёт на создание организации, а не ученика", async ({
  page,
}) => {
  // Розничная и корпоративная заявки требуют разных действий: по первой заводят
  // ученика, по второй — организацию. Кнопка вела в розничную форму всегда, и по
  // свежей заявке об этом легко было забыть.
  await db.lead.deleteMany({ where: { contact: LEAD_CONTACT } });
  await db.lead.create({
    data: {
      name: "Мария",
      contact: LEAD_CONTACT,
      kind: "B2B",
      company: "E2E Заявочная компания",
      seatsWanted: 12,
      status: "NEW",
    },
  });

  await login(page, OWNER_EMAIL, OWNER_PASS);
  await page.goto("/admin/leads");

  const button = page.getByRole("link", { name: "Создать организацию" }).first();
  await expect(button).toBeVisible();
  await button.click();
  await page.waitForURL(/\/admin\/orgs\/new/);

  // Название и контакт переносятся, число мест — в заметку владельцу.
  await expect(page.getByLabel("Наименование организации *")).toHaveValue(
    "E2E Заявочная компания",
  );
  await expect(page.getByLabel("E-mail ответственного")).toHaveValue(LEAD_CONTACT);
  await expect(page.getByLabel("Заметка для себя")).toHaveValue(/12 сотрудников/);
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

test("ответственный создаёт работников сам: логины, пароли и места", async ({
  page,
}) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASS);
  await page.goto(`/org/${orgId}/employees`);

  await page.getByRole("button", { name: "Создать работников" }).click();
  await page.getByLabel("Сколько работников").fill("1");
  await page.getByRole("button", { name: "Создать", exact: true }).click();

  await expect(page.getByText(/Создано учётных записей: 1/)).toBeVisible();

  // Учётка создана без единого персонального данного — как и при самозаписи.
  const membership = await db.orgMembership.findFirstOrThrow({
    where: { orgId, role: "ORG_LEARNER" },
    orderBy: { joinedAt: "desc" },
    include: { user: true },
  });
  expect(membership.user.email).toBeNull();
  expect(membership.user.name).toBeNull();
  expect(membership.user.phone).toBeNull();
  expect(membership.user.login).toMatch(new RegExp(`^${ORG_SLUG}-\\d{4}$`));
  // Пароль временный: при первом входе платформа заставит его сменить.
  expect(membership.user.mustChangePassword).toBe(true);

  // Место выдано из той же лицензии, что и при регистрации по коду.
  const enrollment = await db.enrollment.findFirstOrThrow({
    where: { userId: membership.userId, licenseId },
  });
  expect(enrollment.revokedAt).toBeNull();
  expect(enrollment.source).toBe("B2B");
});

test("имена ведёт клиент: владелец платформы их не видит и ключ не заводит", async ({
  page,
}) => {
  // Ключевая гарантия B2B-контура (оферта /offer-b2b п. 10): платформа не
  // сопоставляет код с человеком. Если владелец сумеет завести ключ или
  // прочитать имя, обещание перестаёт быть правдой — проверяем обе стороны.
  await login(page, ADMIN_EMAIL, ADMIN_PASS);
  await page.goto(`/org/${orgId}/employees`);
  // Основной путь — прямо из строки работника: там же заводится ПИН, там же
  // вводится имя. Полоска сверху остаётся, но начинать с неё не обязательно.
  await page.getByRole("button", { name: "Добавить имя" }).first().click();
  await page.getByPlaceholder("ПИН-код", { exact: true }).fill("2468");
  await page.getByPlaceholder("Повторите").fill("2468");
  await page.getByRole("button", { name: "Включить", exact: true }).click();
  await page.getByRole("checkbox").check(); // код восстановления записан
  await page.getByRole("button", { name: "Дальше" }).click();
  await page.getByPlaceholder("Например, Александр").fill("Александр");
  await page.getByRole("button", { name: "Сохранить имя" }).click();
  await expect(page.getByText("Александр", { exact: true })).toBeVisible();

  // Сервер хранит только шифротекст.
  const stored = await db.orgMembership.findFirstOrThrow({
    where: { orgId, labelEnc: { not: null } },
    select: { labelEnc: true },
  });
  expect(stored.labelEnc).not.toContain("Александр");

  await login(page, OWNER_EMAIL, OWNER_PASS);
  await page.goto(`/org/${orgId}/employees`);
  await expect(page.getByText("Работники показаны кодами")).toBeVisible();
  await expect(page.getByText("Александр", { exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "Присвоить имена" })).toBeHidden();
  await expect(page.getByRole("button", { name: /имя/ })).toBeHidden();
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

test("владелец сбрасывает ПИН-код имён: имена стираются, доступы целы", async ({
  page,
}) => {
  // Клиент забыл и ПИН, и код восстановления. Единственный выход — сброс, и это
  // именно стирание: прочитать имена владелец не может ни до, ни после.
  const before = await db.orgMembership.count({
    where: { orgId, labelEnc: { not: null } },
  });
  expect(before).toBeGreaterThan(0);

  await login(page, OWNER_EMAIL, OWNER_PASS);
  await page.goto(`/admin/orgs/${orgId}`);
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Сбросить ПИН-код имён" }).click();
  await expect(page.getByText(/ПИН-код сброшен/)).toBeVisible();

  expect(await db.orgKeyWrap.count({ where: { orgId } })).toBe(0);
  expect(await db.orgMembership.count({ where: { orgId, labelEnc: { not: null } } })).toBe(0);
  // Доступы к курсам сброс не трогает.
  expect(
    await db.enrollment.count({ where: { licenseId, revokedAt: null } }),
  ).toBeGreaterThan(0);
});

test("отзыв места освобождает его в пуле лицензии", async ({ page }) => {
  const worker = await db.user.findUniqueOrThrow({
    where: { login: `${ORG_SLUG}-0001` },
  });
  // Считаем относительно: сколько мест занято сейчас — зависит от того, сколько
  // работников завели предыдущие тесты. Проверяем сам факт освобождения места.
  const before = await db.enrollment.count({
    where: { licenseId, revokedAt: null },
  });
  expect(before).toBeGreaterThan(0);

  await login(page, ADMIN_EMAIL, ADMIN_PASS);
  await page.goto(`/org/${orgId}/employees`);
  await expect(page.getByText(`${ORG_SLUG}-0001`)).toBeVisible();

  const { revokeSeat } = await import("../src/lib/org/service");
  const enrollment = await db.enrollment.findFirstOrThrow({
    where: { userId: worker.id, licenseId },
  });
  await revokeSeat({ orgId, enrollmentId: enrollment.id });

  const after = await db.enrollment.count({ where: { licenseId, revokedAt: null } });
  expect(after).toBe(before - 1);

  // Доступ к уроку закрылся сразу. Проверяем по ключу AES: он в БД, а плейлист
  // читает файл из медиатеки, которой в тестовой среде может не быть.
  await login(page, `${ORG_SLUG}-0001`, WORKER_PASS);
  const res = await pageFetchStatus(page, `/api/video/key/${paidLessonId}`);
  expect(res).toBe(403);
});
