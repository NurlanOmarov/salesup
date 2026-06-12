import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password.js";

/**
 * Сиды для локальной разработки (BACKLOG P0.3).
 * Учебный контент (HLS-видео/тесты/транскрипты) создаёт фабрика, не сид.
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

type LessonSpec = { title: string; yt: string; durationSec?: number; free?: boolean };
type ModuleSpec = { title: string; lessons: LessonSpec[] };
type CourseSpec = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  industry: string;
  priceTiyn: number;
  oldPriceTiyn?: number;
  hoursLabel: string;
  learnPoints: string[];
  targetAudience: string[];
  faq: { q: string; a: string }[];
  modules: ModuleSpec[];
  coverUrl?: string;
};

// ── Курс 1: Медицинский представитель (реальный YouTube-плейлист) ─────────────
// Источник: https://www.youtube.com/playlist?list=PLbPgy5BEZoQV9jiB5NWRdyj4smlsfiO0D
// Описание: https://activesales.by/product/biznes-trening-medicinskogo-predstavitelya-video-uroki/
// Всего 15 уроков, ~40 мин. Бесплатный превью — урок «О курсе».
const PHARMA_MODULES: ModuleSpec[] = [
  {
    title: "Модуль 1. Выявление потребностей",
    lessons: [
      {
        title: "О курсе — краткое содержание",
        yt: "https://www.youtube.com/watch?v=dv9hCPFmBPk",
        durationSec: 173,
        free: true,
      },
      {
        title: "7 вопросов для выявления потребностей клиента",
        yt: "https://www.youtube.com/watch?v=R-WkZvdyuBY",
        durationSec: 130,
      },
      {
        title: "3 вида вопросов для выявления потребности клиента",
        yt: "https://www.youtube.com/watch?v=m0ZK3jIjol0",
        durationSec: 153,
      },
      {
        title: "5 косвенных вопросов для выявления потребностей",
        yt: "https://www.youtube.com/watch?v=4YaE0FVv7as",
        durationSec: 127,
      },
    ],
  },
  {
    title: "Модуль 2. Методика СПИН",
    lessons: [
      {
        title: "СПИН-вопросы: основы методики",
        yt: "https://www.youtube.com/watch?v=f14PBtwfb3M",
        durationSec: 93,
      },
      {
        title: "Формирование потребностей методом СПИН",
        yt: "https://www.youtube.com/watch?v=wNhrc7nLQEQ",
        durationSec: 251,
      },
    ],
  },
  {
    title: "Модуль 3. Конкурентная среда",
    lessons: [
      {
        title: "Как забрать клиента от конкурента: 7 шагов",
        yt: "https://www.youtube.com/watch?v=v-QZ6utE13U",
        durationSec: 181,
      },
      {
        title: "Как выделиться среди конкурентов в фармацевтическом бизнесе",
        yt: "https://www.youtube.com/watch?v=lQjrXJs2Bqo",
        durationSec: 130,
      },
      {
        title: "Как отстроиться от конкурентов: 5 маркетинговых стратегий",
        yt: "https://www.youtube.com/watch?v=ugA7VcqbebY",
        durationSec: 170,
      },
    ],
  },
  {
    title: "Модуль 4. Убеждение и закрытие сделки",
    lessons: [
      {
        title: "5 техник убеждения клиента",
        yt: "https://www.youtube.com/watch?v=kAW7CFTcwwA",
        durationSec: 91,
      },
      {
        title: "5 методов закрытия сделки",
        yt: "https://www.youtube.com/watch?v=RybBkjcZxVg",
        durationSec: 120,
      },
      {
        title: "7 методов закрытия сделки",
        yt: "https://www.youtube.com/watch?v=tgwZFCTSbPQ",
        durationSec: 174,
      },
      {
        title: "Как закрепить договорённости с клиентом",
        yt: "https://www.youtube.com/watch?v=7EOa9_NywqA",
        durationSec: 64,
      },
    ],
  },
  {
    title: "Модуль 5. Профессиональные принципы",
    lessons: [
      {
        title: "3 золотых правила медицинского представителя",
        yt: "https://www.youtube.com/watch?v=7Ojw_gzTTSk",
        durationSec: 57,
      },
      {
        title: "15 ответов на 5 конфликтных ситуаций",
        yt: "https://www.youtube.com/watch?v=P1WYWaG46-k",
        durationSec: 464,
      },
    ],
  },
];

const COURSES: CourseSpec[] = [
  {
    slug: "sales-pharma",
    title: "Активные продажи для медицинских представителей",
    subtitle: "Техники работы с врачами и аптеками в фармацевтическом бизнесе",
    description:
      "Видеокурс для медицинских представителей, региональных менеджеров и сотрудников фармацевтических компаний. 15 практических уроков по выявлению потребностей, работе с конкурентами, убеждению и закрытию сделок. Методика СПИН, разбор конфликтных ситуаций, 3 золотых правила медпреда. Все уроки записаны практикующим бизнес-тренером по продажам.",
    industry: "Медпредставители",
    priceTiyn: 4_900_000,
    hoursLabel: "15 уроков · ~40 мин",
    learnPoints: [
      "7 вопросов для точного выявления потребностей врача или провизора",
      "Методика СПИН: от вопросов к формированию спроса",
      "7 шагов, чтобы переключить клиента с препарата конкурента на ваш",
      "5 техник убеждения и 12 методов закрытия сделки",
      "3 золотых правила, которые удерживают долгосрочные договорённости",
      "15 готовых ответов на 5 типичных конфликтных ситуаций в поле",
    ],
    targetAudience: [
      "Медицинские представители фармацевтических компаний",
      "Региональные менеджеры и супервайзеры фарм-команд",
      "Новые сотрудники на онбординге в фармацевтических продажах",
      "КАМ-менеджеры по работе с аптечными сетями",
    ],
    faq: [
      {
        q: "Нужно ли медицинское образование для прохождения курса?",
        a: "Нет. Курс посвящён технике продаж и переговоров, а не медицинским знаниям о препаратах. Методики применимы к любому фармацевтическому продукту.",
      },
      {
        q: "Подходит ли курс для работы с аптеками?",
        a: "Да. Большинство техник — выявление потребностей, убеждение, закрытие сделки — одинаково работают как при визите к врачу, так и в переговорах с аптекой.",
      },
      {
        q: "Какова длительность уроков?",
        a: "Уроки короткие — от 1 до 8 минут. Весь курс занимает около 40 минут. Формат рассчитан на просмотр между визитами или в обеденный перерыв.",
      },
      {
        q: "Будет ли сертификат?",
        a: "Да. После прохождения всех уроков и итогового теста вы получаете именной сертификат с уникальным номером и публичной страницей проверки.",
      },
    ],
    modules: PHARMA_MODULES,
    coverUrl: "/images/courses/sales-pharma.png",
  },
  // ── Прочие курсы (каркасы, контент собирает фабрика) ──────────────────────
  {
    slug: "sales-tourism",
    title: "Техники продаж в туризме",
    subtitle: "Как продавать туры дорого и без скидок",
    description:
      "Базовый курс для турагентов и менеджеров туроператоров. Разбираем, как вести клиента от первого звонка до повторной покупки: работа с возражениями «дорого», «подумаю», «сравниваю», защита цены, допродажи.",
    industry: "Туризм",
    priceTiyn: 4_900_000,
    hoursLabel: "6 часов",
    learnPoints: [
      "Техника первого контакта: как за 3 минуты создать доверие",
      "5 методов работы с возражением «дорого» без скидок",
      "Алгоритм закрытия сделки на месте без «подумаю»",
      "Скрипт допродажи страховки, трансфера и экскурсий",
      "Работа с базой: как получать повторные заявки и рекомендации",
    ],
    targetAudience: [
      "Менеджеры и владельцы турагентств",
      "Менеджеры туроператоров по работе с клиентами",
      "Руководители отделов продаж в туризме",
    ],
    faq: [
      { q: "Подойдёт ли курс новичку?", a: "Да. Курс разработан для любого уровня — от стажёра до руководителя отдела." },
      { q: "Есть ли доступ к материалам после окончания?", a: "Да, доступ пожизненный. Все видео, конспекты и задания остаются у вас." },
    ],
    modules: [
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
          { title: "Закрытие сделки и допродажи", yt: "https://youtu.be/PLACEHOLDER4" },
        ],
      },
    ],
    coverUrl: "/images/courses/sales-tourism.png",
  },
  {
    slug: "sales-kitchens",
    title: "Эффективные продажи кухонь",
    subtitle: "Системный подход к продаже мебели в шоу-руме",
    description:
      "Практический курс для продавцов и управляющих мебельных салонов. Весь цикл продажи кухни: встреча у входа, выяснение бюджета, презентация, финальное закрытие без скидок.",
    industry: "Мебель и кухни",
    priceTiyn: 4_900_000,
    oldPriceTiyn: 7_900_000,
    hoursLabel: "7 часов",
    learnPoints: [
      "Правильная встреча клиента: когда подходить и что говорить",
      "Техника выяснения бюджета без прямого вопроса о деньгах",
      "Как провести презентацию кухни через сценарии жизни клиента",
      "Работа с возражениями: «дорого», «подумаю», «в IKEA дешевле»",
      "Алгоритм закрытия: замер → задаток → договор",
    ],
    targetAudience: [
      "Продавцы-консультанты мебельных салонов и шоу-румов",
      "Руководители отделов продаж мебели",
      "Владельцы мебельных магазинов",
    ],
    faq: [
      { q: "Применимо ли только к кухням?", a: "Нет. Методика универсальна для любой корпусной мебели." },
    ],
    modules: [
      {
        title: "Модуль 1. Первый контакт в шоу-руме",
        lessons: [
          { title: "Встреча у входа: когда и как подойти", yt: "https://youtu.be/PLACEHOLDER", free: true },
          { title: "Выяснение потребностей и бюджета", yt: "https://youtu.be/PLACEHOLDER" },
        ],
      },
      {
        title: "Модуль 2. Презентация и закрытие",
        lessons: [
          { title: "Презентация через образ жизни клиента", yt: "https://youtu.be/PLACEHOLDER" },
          { title: "Работа с возражениями и закрытие на задаток", yt: "https://youtu.be/PLACEHOLDER" },
        ],
      },
    ],
    coverUrl: "/images/courses/sales-kitchens.png",
  },
  {
    slug: "sales-shoes",
    title: "Продажи в магазине обуви и одежды",
    subtitle: "Как увеличить средний чек и конверсию в торговом зале",
    description:
      "Курс для продавцов-консультантов и администраторов розничных магазинов. Техника встречи, работа с ценовыми возражениями, допродажи аксессуаров и формирование лояльности покупателей.",
    industry: "Обувь и одежда",
    priceTiyn: 3_900_000,
    hoursLabel: "5 часов",
    learnPoints: [
      "Техника открытия диалога без «Вам помочь?»",
      "Как предлагать более дорогую модель без давления",
      "Допродажа ухода, сумок и аксессуаров — без навязывания",
      "Работа с типичными возражениями в рознице",
      "Формирование базы постоянных покупателей",
    ],
    targetAudience: [
      "Продавцы-консультанты магазинов обуви и одежды",
      "Администраторы и управляющие торговых точек",
      "Владельцы розничных магазинов",
    ],
    faq: [
      { q: "Подходит ли для онлайн-магазина?", a: "Частично. Модули по первому контакту адаптированы под офлайн-формат." },
    ],
    modules: [
      {
        title: "Модуль 1. Встреча и выяснение потребностей",
        lessons: [
          { title: "Открытие диалога в торговом зале", yt: "https://youtu.be/PLACEHOLDER", free: true },
          { title: "Техника подбора модели", yt: "https://youtu.be/PLACEHOLDER" },
        ],
      },
      {
        title: "Модуль 2. Допродажи и лояльность",
        lessons: [
          { title: "Допродажа аксессуаров и ухода", yt: "https://youtu.be/PLACEHOLDER" },
          { title: "Работа с ценовыми возражениями", yt: "https://youtu.be/PLACEHOLDER" },
        ],
      },
    ],
    coverUrl: "/images/courses/sales-shoes.png",
  },
  {
    slug: "sales-realty",
    title: "Техники продаж недвижимости",
    subtitle: "От первого звонка до подписания договора",
    description:
      "Специализированный курс для риэлторов и менеджеров застройщиков. Полный цикл сделки: холодный звонок, показ объекта, переговоры о цене, работа с юридическими сомнениями клиента.",
    industry: "Недвижимость",
    priceTiyn: 5_900_000,
    hoursLabel: "8 часов",
    learnPoints: [
      "Скрипт холодного звонка для назначения встречи",
      "Техника показа объекта: маршрут, акценты, вопросы",
      "Работа с возражением «подумаем» на поздней стадии",
      "Переговоры о цене: как защитить стоимость или предложить альтернативу",
      "Ускорение сделки: работа с ипотечными и юридическими вопросами",
    ],
    targetAudience: [
      "Риэлторы и агенты по недвижимости",
      "Менеджеры отделов продаж застройщиков",
      "Руководители агентств недвижимости",
    ],
    faq: [
      { q: "Есть ли казахстанская специфика?", a: "Да. Примеры — из казахстанского рынка: ипотека, рассрочка от застройщика." },
    ],
    modules: [
      {
        title: "Модуль 1. Входящий и исходящий трафик",
        lessons: [
          { title: "Холодный звонок и квалификация клиента", yt: "https://youtu.be/PLACEHOLDER", free: true },
          { title: "Обработка входящей заявки", yt: "https://youtu.be/PLACEHOLDER" },
        ],
      },
      {
        title: "Модуль 2. Показ и закрытие",
        lessons: [
          { title: "Техника показа объекта", yt: "https://youtu.be/PLACEHOLDER" },
          { title: "Переговоры о цене и закрытие сделки", yt: "https://youtu.be/PLACEHOLDER" },
        ],
      },
    ],
    coverUrl: "/images/courses/sales-realty.png",
  },
  {
    slug: "sales-b2b",
    title: "B2B-переговоры и крупные сделки",
    subtitle: "Системные продажи корпоративным клиентам",
    description:
      "Курс для менеджеров B2B-компаний. Полный цикл корпоративной сделки: поиск ЛПР, первая встреча, ценностное предложение, ценовые переговоры, тендерные процедуры.",
    industry: "B2B-переговоры",
    priceTiyn: 5_900_000,
    oldPriceTiyn: 8_900_000,
    hoursLabel: "9 часов",
    learnPoints: [
      "Карта стейкхолдеров: кто принимает решение и кто влияет",
      "Техника SPIN для выявления потребностей корпоративного клиента",
      "Подготовка и проведение презентации ценностного предложения",
      "Ценовые переговоры: как торговаться без потери маржи",
      "Работа с тендером: как войти в шорт-лист не на цене",
    ],
    targetAudience: [
      "Менеджеры по продажам в B2B и B2G",
      "Руководители отделов корпоративных продаж",
      "Владельцы бизнеса, продающие другим компаниям",
    ],
    faq: [
      { q: "Подходит ли для IT и услуг?", a: "Да. Методика адаптирована под «невещественные» продукты — услуги, SaaS, консалтинг." },
    ],
    modules: [
      {
        title: "Модуль 1. Вход и квалификация",
        lessons: [
          { title: "Поиск ЛПР и первый контакт", yt: "https://youtu.be/PLACEHOLDER", free: true },
          { title: "Квалификация сделки: BANT и MEDDIC", yt: "https://youtu.be/PLACEHOLDER" },
        ],
      },
      {
        title: "Модуль 2. Переговоры и закрытие",
        lessons: [
          { title: "Презентация ценностного предложения", yt: "https://youtu.be/PLACEHOLDER" },
          { title: "Ценовые переговоры и финальное закрытие", yt: "https://youtu.be/PLACEHOLDER" },
        ],
      },
    ],
    coverUrl: "/images/courses/sales-b2b.png",
  },
];

async function upsertCourse(spec: CourseSpec) {
  const course = await db.course.upsert({
    where: { slug: spec.slug },
    update: {
      title: spec.title,
      subtitle: spec.subtitle,
      description: spec.description,
      industry: spec.industry,
      priceTiyn: spec.priceTiyn,
      oldPriceTiyn: spec.oldPriceTiyn ?? null,
      hoursLabel: spec.hoursLabel,
      status: "PUBLISHED",
      learnPoints: spec.learnPoints,
      targetAudience: spec.targetAudience,
      faq: spec.faq,
      coverUrl: spec.coverUrl ?? null,
    },
    create: {
      slug: spec.slug,
      type: "COURSE",
      title: spec.title,
      subtitle: spec.subtitle,
      description: spec.description,
      industry: spec.industry,
      priceTiyn: spec.priceTiyn,
      oldPriceTiyn: spec.oldPriceTiyn ?? null,
      hoursLabel: spec.hoursLabel,
      status: "PUBLISHED",
      accessDuration: "LIFETIME",
      learnPoints: spec.learnPoints,
      targetAudience: spec.targetAudience,
      faq: spec.faq,
      publishedAt: new Date("2026-01-01"),
      coverUrl: spec.coverUrl ?? null,
    },
  });

  const existingModules = await db.module.count({ where: { courseId: course.id } });
  if (existingModules === 0) {
    for (const [mIdx, m] of spec.modules.entries()) {
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
  }

  return course;
}

async function main() {
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

  const student = await db.user.upsert({
    where: { email: STUDENT_EMAIL },
    update: {},
    create: {
      email: STUDENT_EMAIL,
      name: "Тестовый Ученик",
      role: "STUDENT",
      passwordHash: await hashPassword(STUDENT_PASSWORD),
      mustChangePassword: true,
      industry: "Медпредставители",
      locale: "ru",
    },
  });

  for (const b of BADGES) {
    await db.badge.upsert({ where: { code: b.code }, update: {}, create: b });
  }

  const courses = [];
  for (const spec of COURSES) {
    courses.push(await upsertCourse(spec));
  }

  // Отзывы для курса медпреда (VALIDATED — видны на лендинге)
  const pharmaCourse = courses.find((c) => c.slug === "sales-pharma")!;
  const existingReviews = await db.review.count({ where: { courseId: pharmaCourse.id } });
  if (existingReviews === 0) {
    const reviews = [
      { userName: "Алёна Шапарова, специалист FMCG", rating: 5, text: "Теперь у меня есть точный алгоритм общения с клиентом — применяю на каждом визите." },
      { userName: "Светлана Протащук, руководитель филиала JTI", rating: 5, text: "Весь материал усвоен полностью благодаря бизнес-играм и разбору реальных кейсов." },
      { userName: "Елена Овчарова", rating: 5, text: "Информация на 100 баллов. Новые, рабочие схемы — по факту реально рабочие." },
      { userName: "Валентина Шимкович", rating: 5, text: "Тренинг был максимально практичным, без лишней теории и «воды»." },
      { userName: "Антон Сморщок", rating: 5, text: "Тренер не просто давал теорию, а разбирал реальные кейсы и отвечал на все вопросы." },
    ];
    for (const r of reviews) {
      await db.review.create({
        data: { courseId: pharmaCourse.id, autoModeration: "VALIDATED", ...r },
      });
    }
  }

  console.log("✅ Сиды применены:");
  console.log(`   владелец:  ${owner.email}`);
  console.log(`   ученик:    ${student.email} (mustChangePassword=true)`);
  console.log(`   курсы:     ${courses.map((c) => c.slug).join(", ")}`);
  console.log(`   бейджи:    ${BADGES.length}`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
