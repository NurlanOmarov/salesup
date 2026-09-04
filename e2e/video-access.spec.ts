import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { signSegment } from "../src/lib/video/signing";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Есть ли HLS-файлы урока на диске. Плейлист читает master.m3u8 из MEDIA_ROOT,
 * а медиатека живёт на сервере и в репозиторий не попадает: без файлов проверка
 * отдачи вернула бы 404 и выглядела бы поломкой прав, которой нет.
 */
function mediaPresent(videoKey: string | null): boolean {
  if (!videoKey) return false;
  const root = process.env.MEDIA_ROOT ?? "media";
  return existsSync(join(root, videoKey, "master.m3u8"));
}

/**
 * S2.2 AC: защита видео-раздачи.
 *  - без сессии playlist/key/сегмент → 401;
 *  - залогинен, но без enrollment на платный урок → 403;
 *  - бесплатное превью с доступом → playlist/key отдаются (видео играет);
 *  - подпись сегмента после exp → 403.
 */

const db = new PrismaClient();

const STUDENT_EMAIL = "e2e-video@test.local";
const STUDENT_PASS = "video-pass-123";
const PAID_LESSON_VIDEOKEY = "courses/sales-pharma/lessons/_e2e_paid";

let freeLessonId = "";
let freeVideoKey: string | null = null;
let paidLessonId = "";
let aesKeyEnc = "";

test.describe.configure({ mode: "serial" });

// Свой IP для всех запросов этого файла — изолированный rate-limit bucket,
// чтобы успешные логины не пересекались с auth.spec.ts (в e2e nginx нет, IP общий).
test.use({ extraHTTPHeaders: { "x-forwarded-for": "10.99.0.7" } });

test.beforeAll(async () => {
  await db.user.deleteMany({ where: { email: STUDENT_EMAIL } });
  await db.user.create({
    data: {
      email: STUDENT_EMAIL,
      name: "E2E Видео",
      role: "STUDENT",
      passwordHash: await hashPassword(STUDENT_PASS),
      mustChangePassword: false,
    },
  });

  // Реальный закодированный бесплатный урок медпреда (videoStatus READY).
  const intro = await db.lesson.findFirstOrThrow({
    // Донор медиа: любой урок с готовым видео. Раньше искали бесплатный, но
    // бесплатных уроков в каталоге больше нет — фикстура падала на пустом поиске.
    where: { videoStatus: "READY" },
    select: { id: true, videoAesKeyEnc: true, videoKey: true },
  });
  freeLessonId = intro.id;
  freeVideoKey = intro.videoKey;
  aesKeyEnc = intro.videoAesKeyEnc ?? "";

  // Фикстура «платный опубликованный урок без enrollment»: тот же медиа-префикс
  // не нужен — playlist проверяет доступ ДО чтения файлов, поэтому 403 наступит раньше.
  const someModule = await db.module.findFirstOrThrow({
    where: { course: { slug: "sales-pharma" } },
    select: { id: true },
  });
  const paid = await db.lesson.create({
    data: {
      moduleId: someModule.id,
      title: "E2E платный урок",
      sortOrder: 999,
      status: "PUBLISHED",
      isFreePreview: false,
      videoStatus: "READY",
      videoKey: PAID_LESSON_VIDEOKEY,
      videoAesKeyEnc: aesKeyEnc,
    },
  });
  paidLessonId = paid.id;
});

test.afterAll(async () => {
  await db.lesson.deleteMany({ where: { id: paidLessonId } });
  await db.user.deleteMany({ where: { email: STUDENT_EMAIL } });
  await db.$disconnect();
});

test("без сессии playlist/key/сегмент → 401", async ({ request }) => {
  expect((await request.get(`/api/video/playlist/${freeLessonId}`)).status()).toBe(401);
  expect((await request.get(`/api/video/key/${freeLessonId}`)).status()).toBe(401);
  const seg = await request.get(
    `/api/video/media/${PAID_LESSON_VIDEOKEY}/720p/seg_0000.ts?exp=9999999999&sig=deadbeef`,
  );
  expect(seg.status()).toBe(401);
});

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Логин или e-mail").fill(STUDENT_EMAIL);
  await page.getByLabel("Пароль").fill(STUDENT_PASS);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/app/);
}

/**
 * Запрос в контексте залогиненной страницы (fetch шлёт session-cookie по
 * браузерной семантике; APIRequestContext не шлёт Secure-cookie по http).
 */
async function pageFetch(
  page: import("@playwright/test").Page,
  url: string,
): Promise<{ status: number; body: string; bytes: number }> {
  return page.evaluate(async (u) => {
    const r = await fetch(u);
    const buf = await r.arrayBuffer();
    return {
      status: r.status,
      body: new TextDecoder().decode(buf),
      bytes: buf.byteLength,
    };
  }, url);
}

test("залогинен без enrollment на платный урок → 403", async ({ page }) => {
  await login(page);
  expect((await pageFetch(page, `/api/video/playlist/${paidLessonId}`)).status).toBe(403);
  expect((await pageFetch(page, `/api/video/key/${paidLessonId}`)).status).toBe(403);
});

test("бесплатное превью с доступом → playlist и key отдаются", async ({ page }) => {
  test.skip(!mediaPresent(freeVideoKey), "нет HLS-файлов локально (медиатека на сервере)");
  await login(page);

  const playlist = await pageFetch(page, `/api/video/playlist/${freeLessonId}`);
  expect(playlist.status).toBe(200);
  expect(playlist.body).toContain("#EXTM3U");
  expect(playlist.body).toContain(`/api/video/playlist/${freeLessonId}?v=`);

  const key = await pageFetch(page, `/api/video/key/${freeLessonId}`);
  expect(key.status).toBe(200);
  expect(key.bytes).toBe(16); // AES-128
});

test("вариантный плейлист содержит подписанные сегменты и URI ключа", async ({ page }) => {
  test.skip(!mediaPresent(freeVideoKey), "нет HLS-файлов локально (медиатека на сервере)");
  await login(page);
  const variant = await pageFetch(page, `/api/video/playlist/${freeLessonId}?v=720p`);
  expect(variant.status).toBe(200);
  expect(variant.body).toMatch(/\/api\/video\/media\/.*\?exp=\d+&sig=[0-9a-f]+/);
  expect(variant.body).toContain(`URI="/api/video/key/${freeLessonId}"`);
});

test("подпись сегмента после exp → 403", async ({ page }) => {
  await login(page);

  const user = await db.user.findUniqueOrThrow({
    where: { email: STUDENT_EMAIL },
    select: { id: true },
  });
  const segKey = "courses/sales-pharma/lessons/cmqaqmucx000a9kdrjd07l1o4/720p/seg_0000.ts";
  const expiredExp = Math.floor(Date.now() / 1000) - 60;
  const secret = process.env.VIDEO_SIGNING_SECRET!;
  const sig = signSegment(user.id, segKey, expiredExp, secret);

  const res = await pageFetch(page, `/api/video/media/${segKey}?exp=${expiredExp}&sig=${sig}`);
  expect(res.status).toBe(403);
  expect(res.body).toBe("EXPIRED");
});
