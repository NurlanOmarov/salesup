import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * S5.3 AC: публичная проверка сертификата (/verify) и защита скачивания PDF.
 * Полный happy-path выдачи (уроки + экзамен → сертификат) проверен вручную;
 * здесь — статусы verify (подлинный/не найден/отозван) и доступ к PDF.
 */

const db = new PrismaClient();

test.describe.configure({ mode: "serial" });

const VALID_HASH = "e2ecert0valid0000000000000000aa1";
const REVOKED_HASH = "e2ecert0revoked00000000000000bb2";
let courseId = "";
let userId = "";

test.beforeAll(async () => {
  const course = await db.course.findFirstOrThrow({ where: { slug: "sales-pharma" }, select: { id: true } });
  courseId = course.id;
  const user = await db.user.findFirstOrThrow({ where: { role: "OWNER" }, select: { id: true } });
  userId = user.id;

  await db.certificate.deleteMany({ where: { verifyHash: { in: [VALID_HASH, REVOKED_HASH] } } });
  await db.certificate.create({
    data: {
      number: "AS-2026-900001",
      userId,
      courseId,
      holderName: "Проверочный Ученик",
      scorePct: 95,
      hoursLabel: "~40 минут",
      verifyHash: VALID_HASH,
    },
  });
  await db.certificate.create({
    data: {
      number: "AS-2026-900002",
      userId,
      // у одного userId+courseId уникальность — используем другой курс для отозванного
      courseId: (await db.course.findFirstOrThrow({ where: { slug: "sales-tourism" }, select: { id: true } })).id,
      holderName: "Отозванный Ученик",
      verifyHash: REVOKED_HASH,
      revokedAt: new Date(),
    },
  });
});

test.afterAll(async () => {
  await db.certificate.deleteMany({ where: { verifyHash: { in: [VALID_HASH, REVOKED_HASH] } } });
  await db.$disconnect();
});

test("публичная проверка подлинного сертификата (без входа)", async ({ page }) => {
  await page.goto(`/verify/${VALID_HASH}`);
  await expect(page.getByText("Сертификат подлинный")).toBeVisible();
  await expect(page.getByText("Проверочный Ученик")).toBeVisible();
  await expect(page.getByText("AS-2026-900001")).toBeVisible();
});

test("несуществующий сертификат → не найден", async ({ page }) => {
  await page.goto("/verify/deadbeefdeadbeefdeadbeefdeadbeef");
  await expect(page.getByText("Сертификат не найден")).toBeVisible();
});

test("отозванный сертификат → отозван", async ({ page }) => {
  await page.goto(`/verify/${REVOKED_HASH}`);
  await expect(page.getByText("Сертификат отозван")).toBeVisible();
});

test("скачивание PDF без сессии → 401", async ({ request }) => {
  const cert = await db.certificate.findFirstOrThrow({ where: { verifyHash: VALID_HASH }, select: { id: true } });
  const res = await request.get(`/api/certificate/${cert.id}`);
  expect(res.status()).toBe(401);
});
