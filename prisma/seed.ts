import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password.js";

/**
 * Сиды для локальной разработки (BACKLOG P0.3): владелец, тестовый ученик,
 * каркас демо-курса «Техники продаж в туризме» (2 модуля, 4 урока, 1 бесплатный),
 * бейджи. Учебный контент (видео/тесты/транскрипты) создаёт фабрика, не сид.
 */
const db = new PrismaClient();

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "owner@example.kz";
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "owner-dev-pass-123";
const STUDENT_EMAIL = "student@example.kz";
const STUDENT_PASSWORD = process.env.SEED_STUDENT_PASSWORD ?? "student-dev-pass-123";

const BADGES = [
  { code: "first-lesson", title: "Первый урок", description: "Пройден первый урок" },
  { code: "streak-7", title: "7 дней подряд", description: "Неделя обучения без перерыва" },
  { code: "first-ai-client", title: "Первая сделка с ИИ-клиентом", description: "Завершена первая симуляция продажи" },
  { code: "perfect-exam", title: "100% по итоговому тесту", description: "Идеальный результат финального экзамена" },
];

async function main() {
  // ── Владелец ───────────────────────────────────────────────────────────────
  const owner = await db.user.upsert({
    where: { email: OWNER_EMAIL },
    update: {},
    create: {
      email: OWNER_EMAIL,
      name: "Владелец платформы",
      role: "OWNER",
      passwordHash: await hashPassword(OWNER_PASSWORD),
      mustChangePassword: false,
      locale: "ru",
    },
  });

  // ── Тестовый ученик (форс-смена пароля при первом входе) ─────────────────────
  const student = await db.user.upsert({
    where: { email: STUDENT_EMAIL },
    update: {},
    create: {
      email: STUDENT_EMAIL,
      name: "Тестовый Ученик",
      role: "STUDENT",
      passwordHash: await hashPassword(STUDENT_PASSWORD),
      mustChangePassword: true,
      industry: "Туризм",
      locale: "ru",
    },
  });

  // ── Бейджи ───────────────────────────────────────────────────────────────────
  for (const b of BADGES) {
    await db.badge.upsert({ where: { code: b.code }, update: {}, create: b });
  }

  // ── Каркас демо-курса ─────────────────────────────────────────────────────────
  const course = await db.course.upsert({
    where: { slug: "sales-tourism" },
    update: {},
    create: {
      slug: "sales-tourism",
      type: "COURSE",
      title: "Техники продаж в туризме",
      subtitle: "Как продавать туры дорого и без скидок",
      description:
        "Базовый курс по продажам для турагентств. Контент собирается фабрикой из YouTube-плейлиста.",
      industry: "Туризм",
      priceTiyn: 4_900_000, // 49 000 ₸
      accessDuration: "LIFETIME",
      status: "DRAFT",
      hoursLabel: "6 часов",
      sourcePlaylistUrl: "https://www.youtube.com/playlist?list=PLACEHOLDER",
    },
  });

  const lessonsByModule: { title: string; lessons: { title: string; yt: string; free?: boolean }[] }[] = [
    {
      title: "Модуль 1. Установление контакта",
      lessons: [
        { title: "Первое впечатление и доверие", yt: "https://youtu.be/PLACEHOLDER1", free: true },
        { title: "Выявление потребностей туриста", yt: "https://youtu.be/PLACEHOLDER2" },
      ],
    },
    {
      title: "Модуль 2. Работа с возражениями",
      lessons: [
        { title: "Возражение «дорого»", yt: "https://youtu.be/PLACEHOLDER3" },
        { title: "Закрытие сделки", yt: "https://youtu.be/PLACEHOLDER4" },
      ],
    },
  ];

  for (const [mIdx, m] of lessonsByModule.entries()) {
    const moduleRow = await db.module.create({
      data: { courseId: course.id, title: m.title, sortOrder: mIdx },
    });
    for (const [lIdx, l] of m.lessons.entries()) {
      await db.lesson.create({
        data: {
          moduleId: moduleRow.id,
          title: l.title,
          sortOrder: lIdx,
          status: "DRAFT",
          isFreePreview: l.free ?? false,
          youtubeUrl: l.yt,
          videoStatus: "NONE",
        },
      });
    }
  }

  // ── Отзывы (VALIDATED — видны на лендинге) ────────────────────────────────────
  const reviews = [
    { userName: "Айгерим, турагент", rating: 5, text: "Симулятор клиента — это огонь. Отработала возражение «дорого» десятки раз, на реальной продаже уже не растерялась." },
    { userName: "Данияр, мебельный салон", rating: 5, text: "AI-наставник отвечает прямо по уроку и даёт таймкод. Удобно, что можно учиться вечером с телефона." },
    { userName: "Марат, недвижимость", rating: 4, text: "Тесты с разбором ошибок реально заходят. Сертификат добавил в профиль — клиенты стали больше доверять." },
  ];
  const existingReviews = await db.review.count({ where: { courseId: course.id } });
  if (existingReviews === 0) {
    for (const r of reviews) {
      await db.review.create({
        data: { courseId: course.id, autoModeration: "VALIDATED", ...r },
      });
    }
  }

  console.log("✅ Сиды применены:");
  console.log(`   владелец:  ${owner.email} (пароль из SEED_OWNER_PASSWORD)`);
  console.log(`   ученик:    ${student.email} (mustChangePassword=true)`);
  console.log(`   курс:      ${course.slug} (DRAFT, 2 модуля, 4 урока)`);
  console.log(`   отзывы:    ${reviews.length} (VALIDATED)`);
  console.log(`   бейджи:    ${BADGES.length}`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
