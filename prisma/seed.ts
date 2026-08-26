import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password.js";
import { defaultCoursePriceTiyn } from "../src/lib/pricing/index.js";
import { PHARMA_SUMMARIES, type LessonSummary } from "./seed-data/pharma-summaries.js";
import { PHARMA_SLIDES, type LessonDeck } from "./seed-data/pharma-slides.js";
import { PHARMA_LESSON_QUIZZES, type LessonQuizSeed } from "./seed-data/pharma-lesson-quizzes.js";
import { PHARMA_FLASHCARDS, type LessonFlashcards } from "./seed-data/pharma-flashcards.js";
import { PHARMA_OBJECTIONS, type LessonObjections } from "./seed-data/pharma-objections.js";
import {
  PHARMA_CHECKLISTS,
  PHARMA_SCRIPTS,
  PHARMA_AUDITS,
  PHARMA_HOTSPOTS,
  PHARMA_BRANCHING,
  PHARMA_SCENARIOS,
  type LessonScenario,
} from "./seed-data/pharma-interactive.js";
import { B2B_EXAM, B2B_EXAM_PASS_SCORE, type SeedQuestion } from "./seed-data/b2b-exam.js";
import {
  B2B_SUMMARIES,
  B2B_SLIDES,
  B2B_LESSON_QUIZZES,
  B2B_FLASHCARDS,
  B2B_OBJECTIONS,
  B2B_CHECKLISTS,
  B2B_SCRIPTS,
  B2B_AUDITS,
  B2B_HOTSPOTS,
  B2B_BRANCHING,
  B2B_SCENARIOS,
} from "./seed-data/b2b-content.js";
import {
  KITCHEN_SUMMARIES,
  KITCHEN_LESSON_QUIZZES,
  KITCHEN_FLASHCARDS,
  KITCHEN_OBJECTIONS,
  KITCHEN_CHECKLISTS,
  KITCHEN_SCRIPTS,
  KITCHEN_AUDITS,
  KITCHEN_BRANCHING,
  KITCHEN_SCENARIOS,
  KITCHEN_EXAM,
  KITCHEN_EXAM_PASS_SCORE,
} from "./seed-data/kitchen-content.js";
import {
  SPIN_SUMMARIES,
  SPIN_SLIDES,
  SPIN_LESSON_QUIZZES,
  SPIN_FLASHCARDS,
  SPIN_OBJECTIONS,
  SPIN_CHECKLISTS,
  SPIN_SCRIPTS,
  SPIN_AUDITS,
  SPIN_HOTSPOTS,
  SPIN_BRANCHING,
  SPIN_SCENARIOS,
  SPIN_EXAM,
  SPIN_EXAM_PASS_SCORE,
} from "./seed-data/spin-content.js";
import {
  SHOES_SUMMARIES,
  SHOES_SLIDES,
  SHOES_LESSON_QUIZZES,
  SHOES_FLASHCARDS,
  SHOES_OBJECTIONS,
  SHOES_CHECKLISTS,
  SHOES_SCRIPTS,
  SHOES_AUDITS,
  SHOES_HOTSPOTS,
  SHOES_BRANCHING,
  SHOES_SCENARIOS,
  SHOES_EXAM,
  SHOES_EXAM_PASS_SCORE,
} from "./seed-data/shoes-content.js";
import {
  TOURISM_LESSON_QUIZZES,
  TOURISM_SUMMARIES,
  TOURISM_SLIDES,
  TOURISM_FLASHCARDS,
  TOURISM_OBJECTIONS,
  TOURISM_CHECKLISTS,
  TOURISM_SCRIPTS,
  TOURISM_AUDITS,
  TOURISM_HOTSPOTS,
  TOURISM_BRANCHING,
  TOURISM_CLIENT_TYPES,
  TOURISM_SCENARIOS,
  TOURISM_EXAM,
  TOURISM_EXAM_PASS_SCORE,
} from "./seed-data/tourism-content.js";
import {
  REALTY_LESSON_QUIZZES,
  REALTY_SUMMARIES,
  REALTY_SLIDES,
  REALTY_FLASHCARDS,
  REALTY_OBJECTIONS,
  REALTY_CHECKLISTS,
  REALTY_SCRIPTS,
  REALTY_AUDITS,
  REALTY_HOTSPOTS,
  REALTY_BRANCHING,
  REALTY_SCENARIOS,
  REALTY_EXAM,
  REALTY_EXAM_PASS_SCORE,
} from "./seed-data/realty-content.js";
import {
  TIME_LESSON_QUIZZES,
  TIME_FLASHCARDS,
  TIME_CHECKLISTS,
  TIME_SCRIPTS,
  TIME_BRANCHING,
  TIME_METAPHORS,
  TIME_EISENHOWER,
  TIME_RULE6040,
  TIME_SMART,
  TIME_AUDIT,
  TIME_EXAM,
  TIME_EXAM_PASS_SCORE,
} from "./seed-data/time-content.js";
import {
  DIY_SUMMARIES,
  DIY_SLIDES,
  DIY_LESSON_QUIZZES,
  DIY_FLASHCARDS,
  DIY_OBJECTIONS,
  DIY_CHECKLISTS,
  DIY_SCRIPTS,
  DIY_AUDITS,
  DIY_BRANCHING,
  DIY_CLIENT_TYPES,
  DIY_LADDER,
  DIY_CART,
  DIY_SCALE,
  DIY_SCENARIOS,
  DIY_EXAM,
  DIY_EXAM_PASS_SCORE,
} from "./seed-data/diy-content.js";

/**
 * Сиды для локальной разработки (BACKLOG P0.3).
 * Учебный контент (HLS-видео/тесты/транскрипты) создаёт фабрика, не сид.
 */
const db = new PrismaClient();

/**
 * Точечный режим для прода (иначе сид затирает правки админки).
 *   SEED_COURSES=sales-b2b   — обрабатывать только перечисленные курсы (через запятую)
 *   SEED_PRESERVE_COURSE=1   — сохранить поля, которые ведёт админка: цену
 *                              (priceTiyn/oldPriceTiyn), обложку и статус курса.
 *                              Тексты витрины (описание, «чему научитесь», FAQ,
 *                              длительность) при этом обновляются из сида —
 *                              иначе на проде остаётся описание от старого каркаса
 * По умолчанию (локальная разработка) — прежнее поведение: полный сид.
 */
const SEED_COURSES = (process.env.SEED_COURSES ?? "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);
const SEED_PRESERVE_COURSE = process.env.SEED_PRESERVE_COURSE === "1";

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "owner@example.kz";
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "owner-dev-pass-123";
const STUDENT_EMAIL = "student@example.kz";
const STUDENT_PASSWORD = process.env.SEED_STUDENT_PASSWORD ?? "student-dev-pass-123";

const BADGES = [
  { code: "first-lesson", title: "Первый урок", description: "Пройден первый урок" },
  { code: "streak-7", title: "7 дней подряд", description: "Неделя обучения без перерыва" },
  { code: "course-complete", title: "Курс пройден", description: "Пройден весь курс и сдан итоговый экзамен" },
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
  /**
   * Ось витрины «для кого»: EVERYONE — универсальный, SPECIALIZED — под отрасль
   * (по умолчанию). Она же определяет цену — см. lib/pricing.
   */
  audience?: "EVERYONE" | "SPECIALIZED";
  /**
   * Цена задаётся не здесь, а классом курса (`defaultCoursePriceTiyn`): отраслевой —
   * 490 BYN, общая тема — 320 BYN (docs/PRICING-PLAN.md). Явное значение — только
   * если курс осознанно выбивается из сетки. Раньше цены дублировались числом в
   * каждом спеке и разошлись с продом на порядок — больше так не делаем.
   */
  priceTiyn?: number;
  oldPriceTiyn?: number;
  hoursLabel: string;
  inDevelopment?: boolean; // бейдж «В разработке» на витрине (каркасы без контента)
  learnPoints: string[];
  targetAudience: string[];
  faq: { q: string; a: string }[];
  modules: ModuleSpec[];
  coverUrl?: string;
  /** ID промо-ролика на YouTube; видео остаётся на YouTube, у нас только ID. */
  promoYoutubeId?: string;
  /** Ролик вертикальный (Shorts) — плеер показываем 9:16. */
  promoYoutubeVertical?: boolean;
};

// ── Курс «Эффективные продажи кухонь 2.0» (реальный YouTube-плейлист) ────────
// Источник: https://www.youtube.com/playlist?list=PLbPgy5BEZoQUgSLoYOXhE-kXzrxqaVDLM
// Тренер: Виталий Дубовик (activesales.by). 33 доступных ролика (~5 ч 50 мин);
// один ролик плейлиста скрыт автором и в курс не входит. Нумерация уроков —
// авторская (в названиях «Урок №N»), поэтому порядок сохранён как у тренера,
// а модули собраны по смысловым блокам. Бесплатный превью — вводный урок
// с содержанием курса.
const KITCHEN_MODULES: ModuleSpec[] = [
  {
    title: "Модуль 1. Рынок кухонь и правила игры",
    lessons: [
      {
        title: "О курсе: содержание программы для продавцов кухонь",
        yt: "https://www.youtube.com/watch?v=W2EIMlXSmQs",
        durationSec: 387,
        free: true,
      },
      {
        title: "Что курс даст дизайнеру и о тренере",
        yt: "https://www.youtube.com/watch?v=OetiBhiXx3k",
        durationSec: 257,
      },
      {
        title: "Какая ситуация на рынке кухонь сегодня",
        yt: "https://www.youtube.com/watch?v=AtdnuIq1bVM",
        durationSec: 106,
      },
      {
        title: "Игроки на рынке кухонь",
        yt: "https://www.youtube.com/watch?v=P8wtq8mchfk",
        durationSec: 313,
      },
      {
        title: "Какие источники привлечения клиентов работают лучше",
        yt: "https://www.youtube.com/watch?v=IVp12AP0Pss",
        durationSec: 476,
      },
      {
        title: "Что можно и что нельзя в продажах кухонь",
        yt: "https://www.youtube.com/watch?v=kx-1mbcfLZw",
        durationSec: 802,
      },
      {
        title: "Виды продавцов кухонь",
        yt: "https://www.youtube.com/watch?v=T5VIebgYWWw",
        durationSec: 321,
      },
      {
        title: "Чем продажи кухонь отличаются от других товаров",
        yt: "https://www.youtube.com/watch?v=K7Wvz4wajI8",
        durationSec: 448,
      },
    ],
  },
  {
    title: "Модуль 2. Лиды, переписка и звонки",
    lessons: [
      {
        title: "Правила переписки в мессенджерах",
        yt: "https://www.youtube.com/watch?v=sg0WZnBdMFk",
        durationSec: 774,
      },
      {
        title: "Алгоритм работы с лидами",
        yt: "https://www.youtube.com/watch?v=360LjT7-L3E",
        durationSec: 968,
      },
      {
        title: "Алгоритм продаж на входящем звонке",
        yt: "https://www.youtube.com/watch?v=_MeW9J6Ok0Q",
        durationSec: 544,
      },
      {
        title: "Алгоритм исходящего звонка",
        yt: "https://www.youtube.com/watch?v=Nftg85ZMgPo",
        durationSec: 542,
      },
      {
        title: "Скрипт переписки с покупателем",
        yt: "https://www.youtube.com/watch?v=QznvqkTGt58",
        durationSec: 579,
      },
      {
        title: "Скрипт звонка покупателю кухни",
        yt: "https://www.youtube.com/watch?v=Kif9tnwHiyk",
        durationSec: 623,
      },
      {
        title: "Скрипт звонка покупателю в программе: разбор на практике",
        yt: "https://www.youtube.com/watch?v=rHat8ZSQvxc",
        durationSec: 428,
      },
    ],
  },
  {
    title: "Модуль 3. Работа дизайнера и договор",
    lessons: [
      {
        title: "Чек-лист дизайнера кухни",
        yt: "https://www.youtube.com/watch?v=e14i1pnZ52Q",
        durationSec: 929,
      },
      {
        title: "7 советов для заключения договора",
        yt: "https://www.youtube.com/watch?v=_cHswEM0x_U",
        durationSec: 854,
      },
      {
        title: "Зачем дизайнеру разбираться в деталях ремонта заказчика",
        yt: "https://www.youtube.com/watch?v=3rVsr4D79uA",
        durationSec: 597,
      },
    ],
  },
  {
    title: "Модуль 4. Психология покупателя, ошибки и правила",
    lessons: [
      {
        title: "Психология покупателя кухни по типам",
        yt: "https://www.youtube.com/watch?v=mn_KBFzdoHs",
        durationSec: 1429,
      },
      {
        title: "6 фактов и советов в продажах кухонь",
        yt: "https://www.youtube.com/watch?v=898_BL0MZpM",
        durationSec: 552,
      },
      {
        title: "13 типичных ошибок в продажах кухонь",
        yt: "https://www.youtube.com/watch?v=TzDlBAacHao",
        durationSec: 1328,
      },
      {
        title: "10 золотых правил в продажах кухонь",
        yt: "https://www.youtube.com/watch?v=vk545W5bJho",
        durationSec: 796,
      },
    ],
  },
  {
    title: "Модуль 5. Контакт, потребности и убеждение",
    lessons: [
      {
        title: "10 приёмов установления контакта с покупателем кухни",
        yt: "https://www.youtube.com/watch?v=uy4YZC75dzQ",
        durationSec: 731,
      },
      {
        title: "4 правила комплимента покупателю кухни",
        yt: "https://www.youtube.com/watch?v=K3i3aKdpQ-A",
        durationSec: 460,
      },
      {
        title: "Работа с потребностями покупателя: часть 1",
        yt: "https://www.youtube.com/watch?v=xhyn3UPIQnA",
        durationSec: 815,
      },
      {
        title: "Работа с потребностями покупателя: часть 2",
        yt: "https://www.youtube.com/watch?v=go4Dd2YDhqQ",
        durationSec: 334,
      },
      {
        title: "Как убедить купить кухню именно в вашем салоне",
        yt: "https://www.youtube.com/watch?v=8CmNrcLNBmA",
        durationSec: 817,
      },
      {
        title: "Адаптация предложения под потребности покупателя",
        yt: "https://www.youtube.com/watch?v=XN3XhjlgnnA",
        durationSec: 848,
      },
    ],
  },
  {
    title: "Модуль 6. Возражения, конфликты и завершение сделки",
    lessons: [
      {
        title: "Работа с возражениями покупателя кухни",
        yt: "https://www.youtube.com/watch?v=cOysGrL6X0c",
        durationSec: 1323,
      },
      {
        title: "Решение конфликтов с покупателями кухонь",
        yt: "https://www.youtube.com/watch?v=1iMNiRDWcG0",
        durationSec: 676,
      },
      {
        title: "Завершение общения с покупателем кухни",
        yt: "https://www.youtube.com/watch?v=7PZa47jAW5s",
        durationSec: 476,
      },
      {
        title: "Послепродажное обслуживание",
        yt: "https://www.youtube.com/watch?v=GFR7p_J4It8",
        durationSec: 228,
      },
      {
        title: "Дополнительные продукты и инструменты для продаж кухонь",
        yt: "https://www.youtube.com/watch?v=j4RyZG1rTpE",
        durationSec: 308,
      },
    ],
  },
];

// ── Курс «СПИН-продажи» (реальный YouTube-плейлист) ──────────────────────────
// Источник: https://www.youtube.com/playlist?list=PLbPgy5BEZoQWXmEjIFvcKIRl5qKUQB4-9
// Тренер: Виталий Дубовик (activesales.by). Семь роликов: один полный разбор метода
// на всех примерах и шесть отраслевых нарезок из него же. Каждое видео начинается
// с одной и той же теории (4 вида вопросов + «факт → выгода → согласие»), поэтому
// порядок педагогический: короткое демо → полный метод → кейсы по сферам →
// применение вне продаж. Всего ~38 минут. Бесплатный превью — трёхминутный кейс.
const SPIN_MODULES: ModuleSpec[] = [
  {
    title: "Модуль 1. Метод СПИН",
    lessons: [
      {
        title: "СПИН за три минуты: четыре вида вопросов на примере часов",
        yt: "https://www.youtube.com/watch?v=HgeUtmnxhBw",
        durationSec: 174,
        free: true,
      },
      {
        title: "Метод СПИН целиком: разбор на семи разных бизнесах",
        yt: "https://www.youtube.com/watch?v=2bXjvpwFYdU",
        durationSec: 907,
      },
    ],
  },
  {
    title: "Модуль 2. СПИН в рознице и B2B",
    lessons: [
      {
        title: "Розница: строительный супермаркет и DIY",
        yt: "https://www.youtube.com/watch?v=36FZ4BVlnjY",
        durationSec: 282,
      },
      {
        title: "B2B: продажа оборудования предприятиям",
        yt: "https://www.youtube.com/watch?v=2QsRyIFgDNU",
        durationSec: 218,
      },
    ],
  },
  {
    title: "Модуль 3. СПИН в услугах",
    lessons: [
      {
        title: "Финансовые услуги: банк, лизинг, страхование",
        yt: "https://www.youtube.com/watch?v=DlE9Ydj15y8",
        durationSec: 257,
      },
      {
        title: "Услуги: как продавать экспертную работу",
        yt: "https://www.youtube.com/watch?v=ZvAxbKLo8EA",
        durationSec: 230,
      },
    ],
  },
  {
    title: "Модуль 4. СПИН за пределами продаж",
    lessons: [
      {
        title: "Переговоры с ребёнком: как мотивировать учиться",
        yt: "https://www.youtube.com/watch?v=w7ufiGDqHZw",
        durationSec: 189,
      },
    ],
  },
];

// ── Курс «Тайм-менеджмент» (реальный YouTube-плейлист) ───────────────────────
// Источник: https://www.youtube.com/playlist?list=PLbPgy5BEZoQWXLXBB2S2ibfJl8NcI5Jco
// Тренер: Виталий Дубовик (activesales.by). Отобраны 18 роликов из плейлиста
// (без двух видео «для подростков» и промо ACTIVE SALES). Порядок и разбивка по
// модулям — педагогические (от «зачем» к целям, приоритетам, инструментам и
// практике), а не порядок плейлиста. Всего ~2 ч 25 мин. Бесплатный превью —
// короткий вводный урок «Зачем планировать своё время».
const TIME_MODULES: ModuleSpec[] = [
  {
    title: "Модуль 1. Основы и принципы",
    lessons: [
      {
        title: "Зачем планировать своё время: основы тайм-менеджмента",
        yt: "https://www.youtube.com/watch?v=0byud5wh5Bw",
        durationSec: 53,
        free: true,
      },
      {
        title: "Принципы тайм-менеджмента: 5 из 15 основных правил",
        yt: "https://www.youtube.com/watch?v=keVWItaTpDU",
        durationSec: 375,
      },
      {
        title: "Правила тайм-менеджмента: лягушка, слон, три гвоздя",
        yt: "https://www.youtube.com/watch?v=AJr6-DRxGbU",
        durationSec: 613,
      },
      {
        title: "Правило лягушки: с чего начать свой день",
        yt: "https://www.youtube.com/watch?v=rSqRyLExbLI",
        durationSec: 49,
      },
    ],
  },
  {
    title: "Модуль 2. Постановка целей",
    lessons: [
      {
        title: "Как правильно ставить цели в жизни и бизнесе",
        yt: "https://www.youtube.com/watch?v=zdgzKsFW8Ig",
        durationSec: 576,
      },
      {
        title: "Как ставить цели в бизнесе",
        yt: "https://www.youtube.com/watch?v=qx6LVugTFQM",
        durationSec: 357,
      },
    ],
  },
  {
    title: "Модуль 3. Приоритеты и планирование",
    lessons: [
      {
        title: "Матрица Эйзенхауэра: важные и срочные дела",
        yt: "https://www.youtube.com/watch?v=PSgRABQUD-A",
        durationSec: 747,
      },
      {
        title: "Как планировать рабочее время",
        yt: "https://www.youtube.com/watch?v=OUR6xLlM71o",
        durationSec: 576,
      },
      {
        title: "Правило 60/40 в планировании времени",
        yt: "https://www.youtube.com/watch?v=9Ixd8UiG2fk",
        durationSec: 55,
      },
    ],
  },
  {
    title: "Модуль 4. Инструменты планирования",
    lessons: [
      {
        title: "Как вести ежедневник правильно",
        yt: "https://www.youtube.com/watch?v=mdkTcSZwmhY",
        durationSec: 388,
      },
      {
        title: "Идеальный ежедневник: техники планирования",
        yt: "https://www.youtube.com/watch?v=jfe4JGCt7SM",
        durationSec: 94,
      },
      {
        title: "Планирование времени в Google Календаре",
        yt: "https://www.youtube.com/watch?v=b2bYHccEwZ4",
        durationSec: 1099,
      },
      {
        title: "Хронометраж и фотография рабочего дня: пожиратели времени",
        yt: "https://www.youtube.com/watch?v=59gxzvVKa3c",
        durationSec: 475,
      },
    ],
  },
  {
    title: "Модуль 5. Методы и техники на практике",
    lessons: [
      {
        title: "Методы тайм-менеджмента в B2B",
        yt: "https://www.youtube.com/watch?v=2NfFR5zHuwo",
        durationSec: 950,
      },
      {
        title: "Техники тайм-менеджмента для жизни",
        yt: "https://www.youtube.com/watch?v=gcKvBWyLdo4",
        durationSec: 1732,
      },
      {
        title: "Урок тайм-менеджмента (эфир 24.KZ)",
        yt: "https://www.youtube.com/watch?v=bGA07uDVErs",
        durationSec: 357,
      },
    ],
  },
  {
    title: "Модуль 6. Продуктивность и удалённая работа",
    lessons: [
      {
        title: "Почему в офисе работается лучше",
        yt: "https://www.youtube.com/watch?v=K_QDOBNtqDk",
        durationSec: 41,
      },
      {
        title: "Какой процент людей может успешно работать удалённо",
        yt: "https://www.youtube.com/watch?v=0qokT4eL8tw",
        durationSec: 59,
      },
    ],
  },
];

// ── Курс «Продажи в магазине обуви и одежды» (реальный YouTube-плейлист) ─────
// Источник: https://www.youtube.com/playlist?list=PLbPgy5BEZoQVfPIFo1cr9tNamIkIOr380
// Тренер: Виталий Дубовик (activesales.by). В плейлисте 8 роликов: четыре части
// тренинга, ролик «программа курса» и три одинаковых 60-секундных тизера-нарезки
// (в курс не берём — дублируют содержание). Порядок уроков — по этапам продажи
// (плейлист отдан в обратном порядке: 4-я часть первой). Всего ~41 минута.
// Бесплатный превью — вводный ролик с программой курса.
const SHOES_MODULES: ModuleSpec[] = [
  {
    title: "Модуль 1. Контакт с покупателем",
    lessons: [
      {
        title: "О курсе: этапы продажи обуви в салоне",
        yt: "https://www.youtube.com/watch?v=GYBDEetVtqg",
        durationSec: 58,
        free: true,
      },
      {
        title: "Установление контакта с покупателем в торговом зале",
        yt: "https://www.youtube.com/watch?v=y5FOTQKZBUM",
        durationSec: 259,
      },
    ],
  },
  {
    title: "Модуль 2. Потребность, презентация и примерка",
    lessons: [
      {
        title: "Выявление потребности, презентация и примерка обуви",
        yt: "https://www.youtube.com/watch?v=3wNrqmWNgPc",
        durationSec: 565,
      },
    ],
  },
  {
    title: "Модуль 3. Возражения, расширение чека и завершение",
    lessons: [
      {
        title: "Работа с возражениями, допродажи и завершение продажи",
        yt: "https://www.youtube.com/watch?v=dvVvphSZGhs",
        durationSec: 832,
      },
      {
        title: "Методы закрытия сделки и 13 ошибок продавца обуви",
        yt: "https://www.youtube.com/watch?v=v0PUPEQ-58Y",
        durationSec: 760,
      },
    ],
  },
];

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

// ── Курс «Техники продаж в туризме» (реальный YouTube-плейлист) ──────────────
// Источник: https://www.youtube.com/playlist?list=PLbPgy5BEZoQUj4UuzLiAajlHp5dD-0k_Y
// Тренер: Виталий Дубовик (activesales.by). 12 содержательных роликов (~1 ч 8 мин) +
// промо-ролик, который стоит первым как бесплатное превью «о курсе». Второй промо-ролик
// плейлиста (та же нарезка с титрами) — дубль, в курс не входит.
//
// Порядок уроков — педагогический, а не как в плейлисте: сначала из чего складывается
// решение туриста и кто ему продаёт, потом где теряются сделки, затем сам звонок и
// вопросы, дальше типы туристов и возражения, и в финале — закрытие сделки и работа
// на возврат (воронка продаж с удержанием закрывает курс, а не открывает его).
const TOURISM_MODULES: ModuleSpec[] = [
  {
    title: "Модуль 1. Что покупает турист",
    lessons: [
      {
        title: "О курсе: техники продаж в туризме",
        yt: "https://www.youtube.com/watch?v=z-EXqgFaZ3g",
        durationSec: 61,
        free: true,
      },
      {
        title: "Три вещи, которые покупает турист: продукт, компания, продавец",
        yt: "https://www.youtube.com/watch?v=1v4Odxe87_I",
        durationSec: 568,
      },
      {
        title: "Четыре вида продавца: шоумен, ходячий словарь, киллер, партнёр",
        yt: "https://www.youtube.com/watch?v=B6PPYgXGOIQ",
        durationSec: 309,
      },
      {
        title: "Цикл сделки в туризме: четыре этапа глазами туриста",
        yt: "https://www.youtube.com/watch?v=EFSNao0UExA",
        durationSec: 141,
      },
    ],
  },
  {
    title: "Модуль 2. Где теряются сделки",
    lessons: [
      {
        title: "Типичные ошибки в продажах туристических услуг",
        yt: "https://www.youtube.com/watch?v=JKBdMoZFPfU",
        durationSec: 152,
      },
      {
        title: "Зоны опасности: приветствие, имя, вода и незакрытая сделка",
        yt: "https://www.youtube.com/watch?v=kEK5AqTV4Z0",
        durationSec: 423,
      },
    ],
  },
  {
    title: "Модуль 3. Звонок: алгоритм и вопросы",
    lessons: [
      {
        title: "Алгоритм звонка против скрипта: девять шагов входящего",
        yt: "https://www.youtube.com/watch?v=Wz8FDVVEy_w",
        durationSec: 361,
      },
      {
        title: "Воронка вопросов: открытые, альтернативные, закрытые",
        yt: "https://www.youtube.com/watch?v=C8GkIv-6YEk",
        durationSec: 281,
      },
    ],
  },
  {
    title: "Модуль 4. Типы туристов и возражения",
    lessons: [
      {
        title: "Типы туристов: зелёный, синий, красный, жёлтый",
        yt: "https://www.youtube.com/watch?v=vnbMbUO5Lbs",
        durationSec: 672,
      },
      {
        title: "Работа с возражениями: «дорого», «просто изучаю», «я подумаю»",
        yt: "https://www.youtube.com/watch?v=sljN2A4s0oU",
        durationSec: 473,
      },
      {
        title: "Конфликтный турист: как погасить эмоцию и вернуть разговор",
        yt: "https://www.youtube.com/watch?v=7XuuFeUksQE",
        durationSec: 60,
      },
    ],
  },
  {
    title: "Модуль 5. Закрытие сделки и возврат туриста",
    lessons: [
      {
        title: "Пять способов закрыть сделку в туризме",
        yt: "https://www.youtube.com/watch?v=qG0D1gfzqJg",
        durationSec: 108,
      },
      {
        title: "Воронка продаж в туризме: от лида до постоянного туриста",
        yt: "https://www.youtube.com/watch?v=z6FWKffe5wA",
        durationSec: 522,
      },
    ],
  },
];

// ── Курс «Техники продаж недвижимости» (реальный YouTube-плейлист) ──────────
// Источник: https://www.youtube.com/playlist?list=PLbPgy5BEZoQXK5puNilaLSME1PLvuCLFA
// Тренер: Виталий Дубовик (activesales.by). В плейлисте 10 роликов, в курс вошли 9:
// «Эффективные продажи недвижимости» (2 мин) — музыкальная заставка без речи.
//
// Порядок уроков педагогический, а не как в плейлисте: ролик «Как стать риэлтором»
// (роль агента и тактика трёх шагов) поднят из середины в первый модуль, потому что
// он отвечает на вопрос «за что риэлтору платят» и даёт тактику, на которую опираются
// все дальнейшие разборы ошибок. Модули 2–3 идут по авторской нумерации ошибок №1–6.
const REALTY_MODULES: ModuleSpec[] = [
  {
    title: "Модуль 1. Профессия риэлтора: за что вам платят",
    lessons: [
      {
        title: "О курсе: четыре темы и почему риэлтору нужны стальные нервы",
        yt: "https://www.youtube.com/watch?v=oHbuiKJAKhs",
        durationSec: 563,
        free: true,
      },
      {
        title: "Чем продажа недвижимости отличается от любых других продаж",
        yt: "https://www.youtube.com/watch?v=iaJVnYPjSlg",
        durationSec: 565,
      },
      {
        title: "Роль риэлтора сегодня: тактика трёх шагов вместо спора о цене",
        yt: "https://www.youtube.com/watch?v=odCO7qbvfk0",
        durationSec: 194,
      },
    ],
  },
  {
    title: "Модуль 2. Первые три ошибки: лень, обещания, манипуляции",
    lessons: [
      {
        title: "Ошибка №1: банальная лень и скорость реакции на просьбу клиента",
        yt: "https://www.youtube.com/watch?v=Jr7kg0cavDo",
        durationSec: 251,
      },
      {
        title: "Ошибка №2: клиент думает, что вы хотите слить его квартиру",
        yt: "https://www.youtube.com/watch?v=rPQJ_HCu4vI",
        durationSec: 240,
      },
      {
        title: "Ошибка №3: манипуляции, которые ломают сделку",
        yt: "https://www.youtube.com/watch?v=oCnoD5Easbg",
        durationSec: 467,
      },
    ],
  },
  {
    title: "Модуль 3. Потребности, возражения, репутация",
    lessons: [
      {
        title: "Ошибка №4: истинные потребности и квартира мечты",
        yt: "https://www.youtube.com/watch?v=JTmZT3YqSa4",
        durationSec: 316,
      },
      {
        title: "Ошибка №5: неумение работать с возражениями",
        yt: "https://www.youtube.com/watch?v=P0DqPxmXA88",
        durationSec: 429,
      },
      {
        title: "Ошибка №6: репутация агентства и конфликты, которые нельзя делегировать",
        yt: "https://www.youtube.com/watch?v=qJeKTO5LaX0",
        durationSec: 221,
      },
    ],
  },
];

// ── Курс «Продажи в DIY-магазине» (реальный YouTube-плейлист) ────────────────
// Источник: https://www.youtube.com/playlist?list=PLI6WxUjNFy44
// Тренер: Виталий Дубовик (activesales.by). В плейлисте 3 ролика — порядок уроков
// сохранён по авторской нумерации («урок №1/2/3» в названиях), хотя в самом
// плейлисте видео идут вперемешку (2, 1, 3). Всего ~25 минут. Бесплатный превью —
// первый урок (этапы продажи).
const DIY_MODULES: ModuleSpec[] = [
  {
    title: "Модуль 1. Продажи в зале DIY-магазина",
    lessons: [
      {
        title: "Этапы продажи: от контакта до закрытия сделки",
        yt: "https://www.youtube.com/watch?v=ilhhp4k7q7E",
        durationSec: 477,
        free: true,
      },
      {
        title: "Три психотипа покупателя: синий, зелёный, красный",
        yt: "https://www.youtube.com/watch?v=kpPyqiiMAkk",
        durationSec: 411,
      },
      {
        title: "Возражения в DIY-рознице: «дорого», доставка и обмен",
        yt: "https://www.youtube.com/watch?v=8UepyKKgoMQ",
        durationSec: 614,
      },
    ],
  },
];

const COURSES: CourseSpec[] = [
  // ── Курс: Продажи в DIY-магазине (реальный плейлист, контент по видео) ────
  {
    slug: "sales-diy",
    title: "Продажи в DIY-магазине",
    subtitle: "Этапы продажи, психотипы покупателей и работа с возражениями — тренинг для продавцов магазина стройматериалов",
    description:
      "Практический видеокурс бизнес-тренера Виталия Дубовика (activesales.by) для продавцов-консультантов DIY-гипермаркетов и магазинов стройматериалов. 3 урока по реальному тренингу: пять этапов продажи от быстрой консультации до закрытия сделки, четыре роли продавца (ходящий словарь, шоумен, киллер, партнёр), три психотипа покупателя (синий-логик, зелёный-социальный, красный-лидер) со своей эффективной тактикой под каждый, и работа с типичными возражениями DIY-розницы — «слишком дорого», «почему нет доставки», «почему нельзя обменять товар сразу», «довезите до кассы» — без единого оправдания, только позитивным конструктивным ответом.",
    industry: "Стройматериалы и DIY",
    hoursLabel: "~25 минут",
    learnPoints: [
      "Вести быструю консультацию и сразу предлагать помощь, не теряя покупателя в зале",
      "Осознанно переключать роль продавца: ходящий словарь, шоумен, киллер, партнёр",
      "Выявлять потребность через открытые → альтернативные → закрытые вопросы и проверять понимание",
      "Презентовать по схеме характеристика → выгода → конкурентное преимущество",
      "Узнавать три психотипа покупателя и подстраиваться под каждый: синий, зелёный, красный",
      "Отвечать на типичные возражения DIY-розницы без оправданий, только позитивной подачей",
      "Закрывать сделку пятью способами: прямое, через возражение, резюме преимуществ, гарантия, уступка",
    ],
    targetAudience: [
      "Продавцы-консультанты строительных гипермаркетов и магазинов стройматериалов",
      "Новые сотрудники торгового зала на онбординге",
      "Руководители смен и администраторы, которые обучают продавцов",
      "Все, кто продаёт товары для ремонта и нуждается в готовых скриптах",
    ],
    faq: [
      {
        q: "Нужен ли опыт продаж?",
        a: "Нет. Курс начинается с азов: с чего начать разговор в торговом зале и как довести покупателя до кассы.",
      },
      {
        q: "Курс только про стройматериалы?",
        a: "Курс ориентирован на DIY-розницу — краска, плитка, линолеум и похожие товары для ремонта, но техники (этапы продажи, психотипы, работа с возражениями) переносятся на любую розничную торговлю.",
      },
      {
        q: "Сколько времени займёт прохождение?",
        a: "Около 25 минут видео плюс задания и тренажёры. Курс реально пройти за один вечер.",
      },
      {
        q: "Будет ли сертификат?",
        a: "Да. После прохождения уроков и итогового теста вы получаете именной сертификат с уникальным номером и публичной страницей проверки.",
      },
    ],
    modules: DIY_MODULES,
    // Вертикальный промо-ролик тренера (YouTube Shorts) — остаётся на YouTube.
    promoYoutubeId: "8BpOtMv_Qzk",
    promoYoutubeVertical: true,
  },
  {
    slug: "sales-pharma",
    title: "Активные продажи для медицинских представителей",
    subtitle: "Техники работы с врачами и аптеками в фармацевтическом бизнесе",
    description:
      "Видеокурс для медицинских представителей, региональных менеджеров и сотрудников фармацевтических компаний. 15 практических уроков по выявлению потребностей, работе с конкурентами, убеждению и закрытию сделок. Методика СПИН, разбор конфликтных ситуаций, 3 золотых правила медпреда. Все уроки записаны практикующим бизнес-тренером по продажам.",
    industry: "Медпредставители",
    hoursLabel: "~40 минут",
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
  // ── Курс: СПИН-продажи (реальный плейлист, контент по видео) ──────────────
  {
    slug: "sales-spin",
    audience: "EVERYONE", // метод продаж, а не отрасль: примеры от DIY до переговоров с ребёнком
    title: "СПИН-продажи: как формировать потребность",
    subtitle: "Четыре вида вопросов, которые доводят клиента до решения купить",
    description:
      "Практический видеокурс по методу СПИН от бизнес-тренера Виталия Дубовика (activesales.by). Большинство продавцов умеют выявлять потребность открытыми вопросами, но почти никто не умеет её формировать — а именно это отличает консультанта от продавца. Семь уроков: четыре вида вопросов (ситуационные, проблемные, извлекающие, направляющие), схема презентации «факт → выгода → согласие» и готовые наборы вопросов под шесть сфер — строительный супермаркет и DIY, салон часов, поставка оборудования в B2B, банк и лизинг, продажа экспертных услуг и даже разговор с ребёнком об учёбе.",
    industry: "Техники продаж",
    hoursLabel: "~38 минут",
    learnPoints: [
      "Различать четыре вида вопросов СПИН и понимать, какую работу делает каждый",
      "Ситуационными вопросами входить в доверие и показывать, что вы понимаете бизнес клиента",
      "Проблемными вопросами доставать скрытые потребности, о которых клиент ещё не говорит",
      "Извлекающими вопросами переводить проблему из подсознания в осознание — через цену бездействия",
      "Направляющими вопросами подводить клиента к покупке именно у вас",
      "Собирать презентацию по схеме «факт → выгода → согласие» и закрывать вопросом на согласие",
      "Составлять собственные СПИН-цепочки под свой продукт: розница, B2B, финансы, услуги",
    ],
    targetAudience: [
      "Менеджеры по продажам в B2B и рознице",
      "Продавцы-консультанты торгового зала",
      "Специалисты по продаже услуг: финансы, консалтинг, экспертные работы",
      "Руководители отделов продаж, которые ставят скрипты команде",
      "Все, кому важно убеждать: переговоры, работа с подрядчиками, разговор с ребёнком",
    ],
    faq: [
      {
        q: "Нужен ли опыт продаж?",
        a: "Нет. Метод разбирается с нуля: что такое каждый из четырёх видов вопросов и в каком порядке их задавать. Примеры — от покупки часов до поставки оборудования на завод.",
      },
      {
        q: "Курс только для B2B?",
        a: "Нет. В курсе шесть разных сфер: строительный супермаркет и DIY, салон часов, B2B-оборудование, банк и лизинг, экспертные услуги и бытовые переговоры. Метод один — меняются только вопросы.",
      },
      {
        q: "Чем СПИН отличается от обычного выявления потребностей?",
        a: "Открытые вопросы выявляют потребность, которая у клиента уже осознана. СПИН её формирует: проблемные и извлекающие вопросы показывают клиенту проблему и цену бездействия, а направляющие подводят к вашему решению.",
      },
      {
        q: "Сколько времени займёт прохождение?",
        a: "Около 38 минут видео плюс задания и тренажёры. Курс реально пройти за один вечер и сразу собрать свою цепочку вопросов под продукт.",
      },
    ],
    modules: SPIN_MODULES,
    coverUrl: "/images/courses/sales-spin.png",
  },
  // ── Курс: Тайм-менеджмент (реальные видео, контент собирается фабрикой) ────
  {
    slug: "time-management",
    inDevelopment: true,
    audience: "EVERYONE", // универсальный навык — не привязан к отрасли
    title: "Тайм менеджмент: базовые принципы",
    subtitle: "Приоритеты, цели и инструменты управления временем — тренинг Виталия Дубовика",
    description:
      "Практический видеокурс по тайм-менеджменту от бизнес-тренера Виталия Дубовика (activesales.by). 18 уроков — от базовых принципов до готовых инструментов: как расставлять приоритеты по матрице Эйзенхауэра, планировать день по правилу 60/40, начинать с «лягушки», дробить крупные задачи техникой «слон» и «три гвоздя», правильно ставить цели, вести ежедневник и Google Календарь, находить «пожирателей времени» через хронометраж и организовывать продуктивную работу в офисе и удалённо. Материал снят на живых тренингах в B2B, но все модели универсальны.",
    industry: "Тайм-менеджмент",
    hoursLabel: "~2 часа 25 минут",
    learnPoints: [
      "Расставлять приоритеты по матрице Эйзенхауэра: важное против срочного",
      "Планировать день по правилу 60/40 и начинать с «лягушки» — самого неприятного дела",
      "Дробить большие задачи техникой «слон», а мелкие — правилом «трёх гвоздей»",
      "Правильно формулировать цели в жизни и бизнесе",
      "Вести ежедневник и планировать время в Google Календаре",
      "Находить «пожирателей времени» через хронометраж и фотографию рабочего дня",
      "Организовывать продуктивную работу в офисе и на удалёнке",
    ],
    targetAudience: [
      "Руководители и предприниматели, которым не хватает времени",
      "Менеджеры по продажам и специалисты B2B",
      "Все, кто хочет успевать больше без переработок и выгорания",
      "Студенты и начинающие специалисты",
    ],
    faq: [
      {
        q: "Нужна ли специальная подготовка?",
        a: "Нет. Курс начинается с азов управления временем и подойдёт даже тем, кто раньше никогда не планировал день.",
      },
      {
        q: "Курс только для продажников?",
        a: "Нет. Примеры сняты на B2B-аудитории, но все техники — приоритеты, цели, ежедневник, хронометраж — универсальны и работают в любой сфере и в личной жизни.",
      },
      {
        q: "Сколько времени займёт прохождение?",
        a: "Около 2,5 часов видео. Уроки короткие и самостоятельные — можно проходить по одному в день и сразу применять на практике.",
      },
    ],
    modules: TIME_MODULES,
    coverUrl: "/images/courses/time-management.png",
  },
  // ── Курс «Техники продаж в туризме» (реальный плейлист) ───────────────────
  {
    slug: "sales-tourism",
    title: "Техники продаж в туризме",
    subtitle: "От входящего звонка до повторной поездки: алгоритм, вопросы, типы туристов",
    description:
      "Практический видеокурс бизнес-тренера Виталия Дубовика (activesales.by) для менеджеров турагентств и туроператоров. 13 уроков по реальному тренингу: из чего складывается решение туриста (продукт, компания и продавец — на продавца приходится до 87 % влияния), четыре роли продавца, цикл сделки глазами туриста, типичные ошибки и зоны опасности, алгоритм входящего звонка из девяти шагов, воронка вопросов (открытые → альтернативные → закрытые), четыре типа туристов и подстройка под каждый, готовые ответы на «дорого», «я просто изучаю» и «я подумаю», работа с конфликтом, пять способов закрыть сделку и возврат туриста после поездки.",
    industry: "Туризм",
    hoursLabel: "~1 час 9 минут",
    learnPoints: [
      "Понимать, из чего складывается решение туриста: продукт, компания и продавец — и почему продавец решает до 87 %",
      "Сознательно переключать четыре роли продавца: шоумен, ходячий словарь, киллер и партнёр",
      "Вести входящий звонок по алгоритму из девяти шагов — от «трубка до третьего гудка» до записи в CRM",
      "Задавать вопросы воронкой: открытые → альтернативные → закрытые, накапливая согласие к финалу",
      "Узнавать зелёного, синего, красного и жёлтого туриста и менять поведение под каждый тип",
      "Отвечать на «дорого», «я просто изучаю» и «я подумаю» по схеме «амортизация → потребность → проверка понимания → обоснование»",
      "Гасить конфликт без скидок: инициатива, пауза, общая цель, бонус вместо денег",
      "Закрывать сделку пятью способами и возвращать туриста после поездки",
    ],
    targetAudience: [
      "Менеджеры турагентств и туроператоров",
      "Владельцы небольших агентств, которые продают сами",
      "Руководители отделов продаж в туризме",
      "Новички в турбизнесе — на онбординге в первый месяц работы",
    ],
    faq: [
      {
        q: "Подойдёт ли курс новичку?",
        a: "Да. Курс начинается с азов: что вообще покупает турист, как устроен цикл сделки и по какому алгоритму вести входящий звонок. Опытному менеджеру полезны разборы типов туристов и готовые ответы на возражения.",
      },
      {
        q: "Сколько времени займёт прохождение?",
        a: "Около 1 часа 9 минут видео плюс задания, тренажёры и итоговый экзамен. Уроки короткие — от 1 до 11 минут, их реально пройти за пару вечеров или между заявками.",
      },
      {
        q: "Курс только про телефонные звонки?",
        a: "Нет. Алгоритм разбирается на входящем звонке, но те же шаги — приветствие с именем, воронка вопросов, обоснование цены, договорённость о следующем шаге — работают в переписке в мессенджерах и на встрече в офисе.",
      },
      {
        q: "Будет ли сертификат?",
        a: "Да. После прохождения уроков и итогового экзамена вы получаете именной сертификат с уникальным номером и публичной страницей проверки.",
      },
    ],
    modules: TOURISM_MODULES,
    coverUrl: "/images/courses/sales-tourism.png",
  },
  // ── Курс «Техники продаж недвижимости» (реальный плейлист) ────────────────
  {
    slug: "sales-realty",
    title: "Техники продаж недвижимости",
    subtitle: "Шесть ошибок риэлтора и тактика, которая доводит клиента до сделки",
    description:
      "Практический видеокурс бизнес-тренера Виталия Дубовика (activesales.by) для риэлторов, агентов и руководителей агентств недвижимости. 9 уроков про частные продажи физлицам: чем продажа квартиры отличается от любых других продаж и в чём ценность услуги риэлтора, что на самом деле происходит в голове у продавца квартиры (айсберг из восьми родственников, тёщи и СМИ), тактика трёх шагов, после которой клиент сам говорит о снижении цены, и сквозной разбор шести типичных ошибок: банальная лень и скорость реакции, попытка «слить» квартиру ниже рынка, манипуляции с семьёй и эксклюзивом, поверхностно выясненные потребности, неумение работать с возражениями и потеря репутации на конфликте.",
    industry: "Недвижимость",
    hoursLabel: "~54 минуты",
    learnPoints: [
      "Объяснять ценность услуги риэлтора так, чтобы клиент не ушёл продавать сам",
      "Читать айсберг решения: кто ЛПР, кто влияет из семьи и что давит снаружи",
      "Вести клиента тактикой трёх шагов — ответственность, активность, факты — и не спорить о цене",
      "Держать скорость реакции: что должно произойти в первые 48 часов после договора",
      "Не попадать в пять манипуляций, которые ломают сделку и репутацию агентства",
      "Выяснять истинные потребности и подбирать квартиру мечты до продажи текущей",
      "Отвечать на «дорого за услуги» и «я сам продам» и вести свою книгу продаж",
      "Разруливать конфликт и расторжение лично, сохраняя лицо и сарафанное радио",
    ],
    targetAudience: [
      "Риэлторы и агенты по недвижимости",
      "Руководители и владельцы агентств недвижимости",
      "Новички в профессии — на онбординге в первые месяцы",
      "Частные маклеры, которые ведут сделки самостоятельно",
    ],
    faq: [
      {
        q: "Подойдёт ли курс новичку?",
        a: "Да. Курс начинается с азов профессии: чем продажа недвижимости отличается от других продаж, за что клиент платит комиссию и что происходит в голове у продавца квартиры. Опытному агенту полезен сквозной разбор шести ошибок и тактика трёх шагов.",
      },
      {
        q: "Курс про сделки с физлицами или про коммерческую недвижимость?",
        a: "Тренер прямо оговаривает: речь о частных продажах физическим лицам — там, где эмоций и влияющих на решение людей больше всего. Приёмы работы с семьёй, ценой и возражениями применимы и к другим сегментам, но примеры взяты из жилой недвижимости.",
      },
      {
        q: "Сколько времени займёт прохождение?",
        a: "Около 54 минут видео плюс задания, тренажёры и итоговый экзамен. Уроки короткие — от 3 до 10 минут, курс реально пройти за вечер и сразу применить.",
      },
      {
        q: "Будет ли сертификат?",
        a: "Да. После прохождения уроков и итогового экзамена вы получаете именной сертификат с уникальным номером и публичной страницей проверки.",
      },
    ],
    modules: REALTY_MODULES,
    coverUrl: "/images/courses/sales-realty.png",
  },
  {
    slug: "sales-kitchens",
    title: "Эффективные продажи кухонь 2.0",
    subtitle: "Полный курс дизайнера кухонь: от лида в мессенджере до подписанного договора",
    description:
      "Большой видеокурс бизнес-тренера Виталия Дубовика (activesales.by) для дизайнеров и продавцов кухонной мебели. 33 урока и почти шесть часов практики: как устроен рынок кухонь и кто на нём играет, какие источники лидов работают, что можно и чего нельзя делать в салоне, как вести переписку в мессенджерах и звонки по готовым скриптам, чек-лист дизайнера и 7 советов для заключения договора, психология покупателя по типам, 13 типичных ошибок и 10 золотых правил, 10 приёмов установления контакта, работа с потребностями и адаптация предложения, отработка возражений, решение конфликтов, завершение сделки и послепродажное обслуживание.",
    industry: "Мебель и кухни",
    hoursLabel: "~5 часов 50 минут",
    learnPoints: [
      "Понимать рынок кухонь: игроки, конкуренция и источники клиентов, которые реально работают",
      "Вести переписку в мессенджерах и звонки по готовым скриптам — входящие и исходящие",
      "Работать с лидами по алгоритму: от первого касания до записи на замер",
      "Снимать потребности покупателя и адаптировать предложение под его сценарии жизни",
      "Определять психотип покупателя и подбирать под него аргументы",
      "Отрабатывать возражения и решать конфликты без потери сделки и репутации",
      "Доводить до договора: чек-лист дизайнера и 7 советов для подписания",
      "Не допускать 13 типичных ошибок и держать 10 золотых правил продаж кухонь",
    ],
    targetAudience: [
      "Дизайнеры кухонь и продавцы-консультанты мебельных салонов",
      "Руководители отделов продаж и управляющие салонами",
      "Владельцы мебельных производств и студий кухонь",
      "Новые сотрудники салона — как полноценная программа онбординга",
    ],
    faq: [
      {
        q: "Нужен ли опыт в мебельных продажах?",
        a: "Нет. Курс начинается с рынка и базовых правил салона, а дальше даёт готовые скрипты звонков и переписки — по ним можно работать с первого дня.",
      },
      {
        q: "Применимо ли только к кухням?",
        a: "Методика универсальна для любой корпусной мебели и сложных проектных продаж, но все примеры, скрипты и чек-листы — из практики кухонных салонов.",
      },
      {
        q: "Это только про салон или про онлайн тоже?",
        a: "И про то, и про другое: отдельные уроки посвящены лидам из интернета, переписке в мессенджерах и звонкам, а другие — работе в торговом зале и на замере.",
      },
      {
        q: "Сколько времени займёт прохождение?",
        a: "Около шести часов видео плюс задания и тренажёры. Курс разбит на 33 коротких урока — удобно проходить по одному в день.",
      },
    ],
    modules: KITCHEN_MODULES,
    coverUrl: "/images/courses/sales-kitchens.png",
  },
  {
    slug: "sales-shoes",
    title: "Продажи в магазине обуви и одежды",
    subtitle: "Семь этапов продажи в торговом зале: от контакта до второй пары",
    description:
      "Практический видеокурс для продавцов-консультантов обувных и одёжных салонов от бизнес-тренера Виталия Дубовика (activesales.by). Пять уроков — весь цикл работы с покупателем в зале: как позиционироваться в торговом зале и поймать момент для подхода, какими вопросами выявлять потребность, как делать презентацию на языке выгод и правильно выносить три коробки, как отвечать на «дорого», «я просто смотрю», «боюсь неизвестный бренд» и «я подумаю», как расширять чек второй парой и уходом за обувью, восемь способов завершить продажу и 13 типичных ошибок продавца обуви, из-за которых покупатель уходит без покупки.",
    industry: "Обувь и одежда",
    hoursLabel: "~41 минута",
    learnPoints: [
      "Устанавливать контакт: позиционирование в зале, зрительный контакт, контактная фраза — и подход по невербальным сигналам, а не «Вам помочь?»",
      "Выявлять потребность открытыми, альтернативными и закрытыми вопросами, проверять понимание и резюмировать",
      "Делать презентацию по технике «свойство → выгода», правилу трёх коробок и правилу Гомера",
      "Отвечать на четыре типичных возражения покупателя обуви: «дорого», «я просто смотрю», «боюсь неизвестный бренд», «я подумаю»",
      "Расширять чек: вторая пара, аксессуары и уход за обувью — cross-sell, up-sell и down-sell",
      "Завершать сделку восемью способами — от прямого и альтернативного до «короны» покупателю",
      "Не допускать 13 типичных ошибок продавца обуви — от оценки клиента по внешнему виду до «Спасибо, пожалуйста»",
    ],
    targetAudience: [
      "Продавцы-консультанты магазинов обуви и одежды",
      "Администраторы и управляющие торговых точек",
      "Владельцы розничных магазинов",
      "Новые сотрудники салона — как вводный курс за один рабочий перерыв",
    ],
    faq: [
      {
        q: "Нужен ли опыт в продажах?",
        a: "Нет. Курс начинается с базовых техник: как встретить покупателя, что говорить и когда подходить. Подойдёт продавцу с первого дня в зале.",
      },
      {
        q: "Подходит ли для онлайн-магазина?",
        a: "Частично. Работа с возражениями, техника «свойство → выгода» и допродажи применимы и в переписке, но контакт, примерка и работа в зале — про офлайн-салон.",
      },
      {
        q: "Только про обувь или про одежду тоже?",
        a: "Примеры тренер разбирает на обуви, но все семь этапов — контакт, потребность, презентация, возражения, расширение чека, завершение — одинаково работают в любом розничном салоне одежды и аксессуаров.",
      },
      {
        q: "Сколько времени займёт прохождение?",
        a: "Около 41 минуты видео плюс задания и тренажёры. Реально пройти курс за один-два подхода и сразу применить в смене.",
      },
    ],
    modules: SHOES_MODULES,
    coverUrl: "/images/courses/sales-shoes.png",
    // Промо-ролик тренера «Содержание видео-уроков по продажам обуви в розницу
    // за 1 минуту» — остаётся на YouTube, у нас только ID.
    promoYoutubeId: "OXDSOlTZg_Y",
  },
  {
    slug: "sales-b2b",
    title: "B2B-переговоры и крупные сделки",
    subtitle: "Давление, торг и работа с ЛПР: переговоры как управляемый процесс",
    description:
      "Живой тренинг и системный курс бизнес-тренера Виталия Дубовика по деловым переговорам и продажам в B2B. 28 уроков в семи модулях: проактивная подготовка вместо реакции на рынок, карта ролей в компании клиента (ЛПР, ЛВР, ЛДПР) и математика воронки, четыре типа переговоров — «железо, бронза, серебро, золото» — с разбором 11 тактик манипуляции, VIP-переговоры и методика СПИН. Дальше — система из 11 уроков B2B-продаж: сегментация лидов, путь клиента и конверсия этапов, удержание, сильное коммерческое предложение, фиксация договорённостей. Затем блок о цене и премиальном сегменте — пирамида потребностей партнёра, продажа сложного и дорогого продукта, холодные звонки, конфликты, GAPP-анализ. Финал — работа в полях: ошибки торгового представителя и вход в сеть. В конце — итоговый тест на 20 вопросов по содержанию уроков.",
    industry: "B2B-переговоры",
    hoursLabel: "~1 час 40 минут",
    learnPoints: [
      "Проактивный подход: готовиться к переговорам вместо реакции «дали — взял»",
      "ЛПР и ЛВР: кто говорит «да», когда все говорят «нет», и правило 2Н — нужные вопросы нужным людям",
      "Воронка от незнакомца до адвоката бренда и честная математика отказов (конверсия 1–3%)",
      "Четыре типа переговоров: железо (давление), бронза (торг), серебро (консультация), золото (партнёрство)",
      "11 тактик манипуляции оппонента и как им не поддаться: пауза, парковка возражения, красивый уход",
      "План обмена: как размениваться переменными сделки, а не отдавать скидку",
      "VIP-переговоры: свобода решения, «назови мотив хода», косвенные вопросы и накопление согласия",
      "Методика СПИН: ситуационные → проблемные → извлекающие → направляющие вопросы",
      "Сегментация лидов и путь клиента: где теряется конверсия и с кем работать в первую очередь",
      "Коммерческое предложение, которое читают, и фиксация договорённостей после встречи",
      "Пирамида потребностей партнёра: как продавать дороже рынка и заводить премиальный продукт",
      "Холодные звонки в B2B по алгоритму из четырёх шагов и конфликты как рабочий этап переговоров",
    ],
    targetAudience: [
      "Менеджеры по продажам в B2B и B2G",
      "Руководители отделов корпоративных продаж",
      "КАМ-менеджеры и специалисты по работе с ключевыми клиентами",
      "Владельцы бизнеса, которые сами ведут крупные сделки",
    ],
    faq: [
      { q: "Подходит ли для IT и услуг?", a: "Да. Методика адаптирована под «невещественные» продукты — услуги, SaaS, консалтинг." },
      {
        q: "Нужен ли опыт переговоров?",
        a: "Достаточно базового. Курс даёт структуру встречи и готовые фразы, поэтому подходит и тем, кто только начал вести крупные сделки.",
      },
      {
        q: "Что нужно сделать после курса?",
        a: "Выбрать одну реальную встречу, подготовиться к ней по алгоритмам курса, провести переговоры и пройти итоговый тест из 20 вопросов (проходной балл — 75%).",
      },
      {
        q: "Примеры в видео — из разных отраслей. Подойдёт ли курс моей сфере?",
        a: "Да. Уроки сняты на разных аудиториях — поставщики HoReCa, оконная фурнитура, работа торгового представителя с сетями, — но все модели (ЛПР/ЛВР, типы переговоров, тактики манипуляции, СПИН, пирамида потребностей) универсальны. Конспекты и задания курса даны на нейтральных B2B-примерах.",
      },
    ],
    // Структура собрана ПО РЕАЛЬНОМУ содержанию видео, а не по блокам презентации.
    // Модули 1–4 — живой тренинг из четырёх частей (playlist PLPVUOXpAlSF4; пятый
    // ролик — полная 25-минутная версия, age-restricted — намеренно не включён).
    // Модули 5–7 добавлены из плейлиста PLbPgy5BEZoQVn4S27QaFdcCMR9vZKc82a: система
    // из 11 уроков B2B-продаж, блок цены и премиального сегмента, работа в полях.
    modules: [
      {
        title: "Модуль 1. Подготовка и проактивный подход",
        lessons: [
          {
            title: "Проактивный подход: подготовка вместо реакции",
            yt: "https://www.youtube.com/watch?v=823Y0bwGvoQ",
            durationSec: 373,
            free: true,
          },
        ],
      },
      {
        title: "Модуль 2. Клиент: роли и воронка",
        lessons: [
          {
            title: "ЛПР и ЛВР, воронка продаж и работа с отказами",
            yt: "https://www.youtube.com/watch?v=NfWBj19OMoY",
            durationSec: 323,
          },
        ],
      },
      {
        title: "Модуль 3. Типы переговоров и давление",
        lessons: [
          {
            title: "Четыре типа переговоров: давление, торг, консультация, партнёрство",
            yt: "https://www.youtube.com/watch?v=unIxHDJBvDQ",
            durationSec: 529,
          },
        ],
      },
      {
        title: "Модуль 4. VIP-переговоры и формирование потребности",
        lessons: [
          {
            title: "VIP-переговоры: доверие, мотив хода и методика СПИН",
            yt: "https://www.youtube.com/watch?v=QoBNde4dMTk",
            durationSec: 407,
          },
        ],
      },
      // ── Дополнение курса вторым плейлистом (2026-07) ──────────────────────
      // Источник: https://www.youtube.com/playlist?list=PLbPgy5BEZoQVn4S27QaFdcCMR9vZKc82a
      // Серия «11 уроков продаж в B2B» (обзор + короткие уроки по одному на тему),
      // практические разборы (возражения партнёров, премиальный сегмент, холодные
      // звонки, GAPP-анализ) и блок для работы в полях. Промо-ролики о школе
      // в курс не включены.
      {
        title: "Модуль 5. Система B2B-продаж: 11 уроков",
        lessons: [
          {
            title: "11 уроков продаж в B2B: обзор системы",
            yt: "https://www.youtube.com/watch?v=KL-dTUYVy6g",
            durationSec: 544,
          },
          {
            title: "Кто такой ЛПР, ЛВР и ЛДПР",
            yt: "https://www.youtube.com/watch?v=r7jAaOg8XYQ",
            durationSec: 51,
          },
          {
            title: "Как убеждать ЛВР в B2B",
            yt: "https://www.youtube.com/watch?v=lrxhFlrnxcc",
            durationSec: 61,
          },
          {
            title: "Путь клиента в B2B и конверсия этапов",
            yt: "https://www.youtube.com/watch?v=LEMjtyE50l0",
            durationSec: 61,
          },
          {
            title: "Сегментация клиентов среди всех лидов",
            yt: "https://www.youtube.com/watch?v=waJnetzF7VY",
            durationSec: 61,
          },
          {
            title: "Как удержать клиента в B2B",
            yt: "https://www.youtube.com/watch?v=z4fbQmoNMjw",
            durationSec: 47,
          },
          {
            title: "Как улучшить коммерческое предложение",
            yt: "https://www.youtube.com/watch?v=LyMzhiK61Us",
            durationSec: 45,
          },
          {
            title: "Подготовка к важным переговорам",
            yt: "https://www.youtube.com/watch?v=6sxfr4L9bDo",
            durationSec: 61,
          },
          {
            title: "Девятый урок B2B: работа с текущей базой",
            yt: "https://www.youtube.com/watch?v=DtvHNT6O7s4",
            durationSec: 47,
          },
          {
            title: "Десятый урок B2B: фиксация договорённостей",
            yt: "https://www.youtube.com/watch?v=zQRV0tPJ7EE",
            durationSec: 61,
          },
          {
            title: "Как реагировать на изменения в принятии решения",
            yt: "https://www.youtube.com/watch?v=GUlLdRBDxOI",
            durationSec: 59,
          },
          {
            title: "Как вести себя в разных ситуациях переговоров",
            yt: "https://www.youtube.com/watch?v=64nE3R2Kz5A",
            durationSec: 61,
          },
        ],
      },
      {
        title: "Модуль 6. Цена, премиальный сегмент и холодные звонки",
        lessons: [
          {
            title: "Ожидания от сделки на переговорах",
            yt: "https://www.youtube.com/watch?v=JQqnoEHBlfQ",
            durationSec: 58,
          },
          {
            title: "Три вида переговоров с партнёром",
            yt: "https://www.youtube.com/watch?v=X42NDY0s18U",
            durationSec: 60,
          },
          {
            title: "Пирамида потребностей партнёра: как продавать дороже рынка",
            yt: "https://www.youtube.com/watch?v=5wyLmPejne4",
            durationSec: 129,
          },
          {
            title: "Как продавать сложный и дорогой продукт",
            yt: "https://www.youtube.com/watch?v=oyVUmTYpDQY",
            durationSec: 59,
          },
          {
            title: "Как убедить партнёра работать с премиальным продуктом",
            yt: "https://www.youtube.com/watch?v=WdKJbGTAri0",
            durationSec: 186,
          },
          {
            title: "Возражения партнёров на примере оконной фурнитуры",
            yt: "https://www.youtube.com/watch?v=XEOMl7JTeqw",
            durationSec: 316,
          },
          {
            title: "Холодные звонки в B2B: алгоритм из четырёх шагов",
            yt: "https://www.youtube.com/watch?v=EFS0S2W1L18",
            durationSec: 180,
          },
          {
            title: "Конфликты в переговорах: как к ним относиться",
            yt: "https://www.youtube.com/watch?v=Wi3-sr1xTUE",
            durationSec: 60,
          },
          {
            title: "GAPP-анализ на примере партнёра: разбор",
            yt: "https://www.youtube.com/watch?v=U8pac-uqoCA",
            durationSec: 1163,
          },
        ],
      },
      {
        title: "Модуль 7. Работа в полях: торговый представитель",
        lessons: [
          {
            title: "8 ошибок торгового представителя",
            yt: "https://www.youtube.com/watch?v=oSfR75Bm-sU",
            durationSec: 375,
          },
          {
            title: "8 финансовых ошибок в работе торгового представителя",
            yt: "https://www.youtube.com/watch?v=24LrEqsdwzs",
            durationSec: 512,
          },
          {
            title: "Как стать на полку: принцип «пули со смещённым центром»",
            yt: "https://www.youtube.com/watch?v=2ieom5wEKDg",
            durationSec: 91,
          },
        ],
      },
    ],
    coverUrl: "/images/courses/sales-b2b.png",
  },
];

async function upsertCourse(spec: CourseSpec) {
  // SEED_PRESERVE_COURSE: цену, обложку и статус ведёт админка — их не трогаем,
  // тексты витрины обновляем (описание старого каркаса иначе останется на проде).
  if (SEED_PRESERVE_COURSE) {
    const existing = await db.course.findUnique({ where: { slug: spec.slug }, select: { id: true, slug: true } });
    if (existing) {
      await db.course.update({
        where: { id: existing.id },
        data: {
          title: spec.title,
          subtitle: spec.subtitle,
          description: spec.description,
          industry: spec.industry,
          audience: spec.audience ?? "SPECIALIZED",
          hoursLabel: spec.hoursLabel,
          learnPoints: spec.learnPoints,
          targetAudience: spec.targetAudience,
          faq: spec.faq,
        },
      });
      console.log(`   курс ${spec.slug}: тексты обновлены, цена/обложка/статус сохранены`);
      await createMissingModules(existing.id, spec);
      return existing;
    }
  }

  // Цена — из класса курса и его объёма (lib/pricing), если спек не переопределяет.
  const coursePriceTiyn = (s: CourseSpec): number => {
    if (s.priceTiyn) return s.priceTiyn;
    const totalSec = s.modules
      .flatMap((m) => m.lessons)
      .reduce((sum, l) => sum + (l.durationSec ?? 0), 0);
    return defaultCoursePriceTiyn(s.audience ?? "SPECIALIZED", totalSec || null);
  };

  const course = await db.course.upsert({
    where: { slug: spec.slug },
    update: {
      title: spec.title,
      subtitle: spec.subtitle,
      description: spec.description,
      industry: spec.industry,
      audience: spec.audience ?? "SPECIALIZED",
      priceTiyn: coursePriceTiyn(spec),
      oldPriceTiyn: spec.oldPriceTiyn ?? null,
      hoursLabel: spec.hoursLabel,
      status: "PUBLISHED",
      inDevelopment: spec.inDevelopment ?? false,
      learnPoints: spec.learnPoints,
      targetAudience: spec.targetAudience,
      faq: spec.faq,
      coverUrl: spec.coverUrl ?? null,
      promoYoutubeId: spec.promoYoutubeId ?? null,
      promoYoutubeVertical: spec.promoYoutubeVertical ?? false,
    },
    create: {
      slug: spec.slug,
      type: "COURSE",
      title: spec.title,
      subtitle: spec.subtitle,
      description: spec.description,
      industry: spec.industry,
      audience: spec.audience ?? "SPECIALIZED",
      priceTiyn: coursePriceTiyn(spec),
      oldPriceTiyn: spec.oldPriceTiyn ?? null,
      hoursLabel: spec.hoursLabel,
      status: "PUBLISHED",
      inDevelopment: spec.inDevelopment ?? false,
      accessDuration: "LIFETIME",
      learnPoints: spec.learnPoints,
      targetAudience: spec.targetAudience,
      faq: spec.faq,
      publishedAt: new Date("2026-01-01"),
      coverUrl: spec.coverUrl ?? null,
      promoYoutubeId: spec.promoYoutubeId ?? null,
      promoYoutubeVertical: spec.promoYoutubeVertical ?? false,
    },
  });

  await createMissingModules(course.id, spec);

  return course;
}

/**
 * Снести каркасную структуру курса, если она ещё «пустая»: все уроки — заглушки
 * (youtubeUrl с PLACEHOLDER, видео не собрано) и ни один ученик их не проходил.
 * Нужно, когда каркас курса уже создан на проде, а затем появляется реальный
 * плейлист: без этого createMissingModules() увидит модули и ничего не изменит.
 * Возвращает true, если структура удалена и её надо создать заново.
 */
async function dropPlaceholderModules(courseId: string): Promise<boolean> {
  const lessons = await db.lesson.findMany({
    where: { module: { courseId } },
    select: { id: true, youtubeUrl: true, videoStatus: true },
  });
  if (lessons.length === 0) return false;
  const allPlaceholders = lessons.every(
    (l) => (l.youtubeUrl ?? "").includes("PLACEHOLDER") && l.videoStatus === "NONE",
  );
  if (!allPlaceholders) return false;
  const touched = await db.lessonProgress.count({ where: { lessonId: { in: lessons.map((l) => l.id) } } });
  if (touched > 0) return false;

  await db.module.deleteMany({ where: { courseId } });
  console.log(`   курс: удалён каркас из ${lessons.length} уроков-заглушек — создаю реальную структуру`);
  return true;
}

/**
 * Дополнить курс модулями и уроками, которых ещё нет.
 *
 * Курс живёт: к нему добавляют новые плейлисты (так дополнялся sales-b2b), поэтому
 * сопоставляем по названию — существующие модули и уроки не трогаем (у них уже есть
 * видео, прогресс учеников и контент), а недостающие досоздаём в конец.
 */
async function addMissingLessons(courseId: string, spec: CourseSpec) {
  const modules = await db.module.findMany({
    where: { courseId },
    select: { id: true, title: true, sortOrder: true, lessons: { select: { title: true } } },
  });
  let nextModuleOrder = modules.reduce((max, m) => Math.max(max, m.sortOrder), -1) + 1;

  for (const m of spec.modules) {
    const existing = modules.find((x) => x.title === m.title);
    if (!existing) {
      const created = await db.module.create({
        data: { courseId, title: m.title, sortOrder: nextModuleOrder++ },
      });
      for (const [lIdx, l] of m.lessons.entries()) {
        await db.lesson.create({
          data: {
            moduleId: created.id,
            title: l.title,
            sortOrder: lIdx,
            status: l.free ? "PUBLISHED" : "DRAFT",
            isFreePreview: l.free ?? false,
            youtubeUrl: l.yt,
            durationSec: l.durationSec ?? null,
            videoStatus: "NONE",
          },
        });
      }
      console.log(`   + модуль «${m.title}» (${m.lessons.length} уроков)`);
      continue;
    }

    const missing = m.lessons.filter((l) => !existing.lessons.some((x) => x.title === l.title));
    if (missing.length === 0) continue;
    const lastOrder = existing.lessons.length;
    for (const [i, l] of missing.entries()) {
      await db.lesson.create({
        data: {
          moduleId: existing.id,
          title: l.title,
          sortOrder: lastOrder + i,
          status: l.free ? "PUBLISHED" : "DRAFT",
          isFreePreview: l.free ?? false,
          youtubeUrl: l.yt,
          durationSec: l.durationSec ?? null,
          videoStatus: "NONE",
        },
      });
    }
    console.log(`   + ${missing.length} урок(ов) в модуль «${m.title}»`);
  }
}

/** Создать модули и уроки курса, если их ещё нет (существующие не трогаем). */
async function createMissingModules(courseId: string, spec: CourseSpec) {
  await dropPlaceholderModules(courseId);
  const existingModules = await db.module.count({ where: { courseId } });
  if (existingModules > 0) {
    await addMissingLessons(courseId, spec);
    return;
  }
  if (existingModules === 0) {
    for (const [mIdx, m] of spec.modules.entries()) {
      const moduleRow = await db.module.create({
        data: { courseId, title: m.title, sortOrder: mIdx },
      });
      for (const [lIdx, l] of m.lessons.entries()) {
        await db.lesson.create({
          data: {
            moduleId: moduleRow.id,
            title: l.title,
            sortOrder: lIdx,
            // Бесплатное превью публикуем сразу (маркетинг: «первый урок бесплатно»);
            // остальные уроки остаются DRAFT, пока фабрика не соберёт контент.
            status: l.free ? "PUBLISHED" : "DRAFT",
            isFreePreview: l.free ?? false,
            youtubeUrl: l.yt,
            durationSec: l.durationSec ?? null,
            videoStatus: "NONE",
          },
        });
      }
    }
  }
}

// ── Финальный экзамен медпред-курса (вопросы по реальному содержанию видео) ──
// Для ORDERING варианты заданы в правильном порядке (sortOrder = индекс), на клиенте
// перемешиваются. Для FILL_BLANK options.text — эталонные ответы по порядку пропусков.
// Тип SeedQuestion — в seed-data/b2b-exam.ts (MATCHING: text=левый, pairKey=правый;
// CATEGORIZATION: text=элемент, pairKey=категория).
const PHARMA_EXAM: SeedQuestion[] = [
  {
    type: "ORDERING",
    text: "Расставьте типы вопросов методики СПИН в правильном порядке — от первого к последнему.",
    explanation: "Последовательность СПИН: сначала узнаём ситуацию, затем выявляем проблемы, усиливаем их важность и подводим к решению.",
    options: [
      { text: "Ситуационные", correct: true },
      { text: "Проблемные", correct: true },
      { text: "Извлекающие", correct: true },
      { text: "Направляющие", correct: true },
    ],
  },
  {
    type: "FILL_BLANK",
    text: "Презентация препарата строится на трёх моментах. Впишите их по порядку (по одному слову).",
    explanation: "«Презентация основывается на трёх моментах: факт, выгода, согласие».",
    options: [
      { text: "факт", correct: true },
      { text: "выгода", correct: true },
      { text: "согласие", correct: true },
    ],
  },
  {
    type: "MATCHING",
    text: "Сопоставьте технику убеждения с её сутью.",
    explanation: "5 техник убеждения: «боль—решение—результат», язык пользы, визуализация, УТП, сравнение с аналогами.",
    options: [
      { text: "Язык пользы", correct: true, pairKey: "меньше риск инсульта вместо «−10 мм рт. ст.»" },
      { text: "Визуализация", correct: true, pairKey: "графики, таблицы, упаковки" },
      { text: "Сравнение с аналогами", correct: true, pairKey: "корректно: «меньше побочных, проще режим»" },
      { text: "УТП", correct: true, pairKey: "чем препарат лучше конкурентов и как подтверждено" },
    ],
  },
  {
    type: "CATEGORIZATION",
    text: "Распределите действия медпреда по «золотым правилам»: что делать, а что — нет.",
    explanation: "Делай: подводи к действию без давления, упоминай других врачей, фиксируй мостик. Не делай: спрашивать в лоб про назначение, спорить агрессивно, уходить без следующего шага.",
    options: [
      { text: "Подводить к действию, не давить", correct: true, pairKey: "Делай" },
      { text: "Упоминать других врачей с данными", correct: true, pairKey: "Делай" },
      { text: "Спрашивать в лоб «будете назначать?»", correct: true, pairKey: "Не делай" },
      { text: "Спорить и переубеждать агрессивно", correct: true, pairKey: "Не делай" },
    ],
  },
  {
    type: "SINGLE_CHOICE",
    text: "Какие три типа вопросов для выявления потребностей называет тренер в начале курса?",
    explanation: "В обзоре курса: «существуют открытые, альтернативные и закрытые вопросы».",
    options: [
      { text: "Открытые, альтернативные и закрытые", correct: true },
      { text: "Простые, сложные и наводящие", correct: false },
      { text: "Личные, рабочие и финансовые", correct: false },
      { text: "Устные, письменные и визуальные", correct: false },
    ],
  },
  {
    type: "SINGLE_CHOICE",
    text: "Из каких типов вопросов состоит методика СПИН?",
    explanation: "Ситуационные → проблемные → извлекающие → направляющие — последовательность СПИН для формирования потребности.",
    options: [
      { text: "Ситуационные, проблемные, извлекающие, направляющие", correct: true },
      { text: "Открытые, закрытые, риторические, уточняющие", correct: false },
      { text: "Вступительные, основные, дополнительные, финальные", correct: false },
      { text: "Логические, эмоциональные, рациональные, спонтанные", correct: false },
    ],
  },
  {
    type: "SINGLE_CHOICE",
    text: "Что делают ИЗВЛЕКАЮЩИЕ вопросы в методике СПИН?",
    explanation: "Извлекающие вопросы усиливают важность проблемы и помогают врачу осознать её последствия.",
    options: [
      { text: "Усиливают важность проблемы и показывают её последствия", correct: true },
      { text: "Узнают общую ситуацию в отделении", correct: false },
      { text: "Сразу презентуют препарат", correct: false },
      { text: "Завершают сделку и фиксируют заказ", correct: false },
    ],
  },
  {
    type: "SINGLE_CHOICE",
    text: "На каких трёх моментах строится презентация препарата по методике курса?",
    explanation: "Презентация основывается на трёх моментах: факт, выгода, согласие.",
    options: [
      { text: "Факт, выгода, согласие", correct: true },
      { text: "Цена, скидка, бонус", correct: false },
      { text: "Проблема, паника, решение", correct: false },
      { text: "Вопрос, ответ, пауза", correct: false },
    ],
  },
  {
    type: "MULTI_CHOICE",
    text: "Какие шаги входят в стратегию «забрать клиента от конкурента»? (несколько вариантов)",
    explanation: "Среди 7 шагов: изучить клиента (SWOT), дать попробовать образцы, использовать социальное доказательство. Агрессивное давление прямо НЕ рекомендуется («будь настойчив, но не агрессивен»).",
    options: [
      { text: "Изучить клиента и составить SWOT-анализ", correct: true },
      { text: "Дать попробовать образцы или тестовую партию", correct: true },
      { text: "Использовать социальное доказательство (отзывы, кейсы)", correct: true },
      { text: "Давить на клиента, пока он не согласится", correct: false },
    ],
  },
  {
    type: "MULTI_CHOICE",
    text: "Какие техники убеждения врача разбираются в курсе? (несколько вариантов)",
    explanation: "Среди 5 техник: «боль — решение — результат», язык пользы, УТП, визуализация, корректное сравнение с аналогами. Прямое очернение конкурента не рекомендуется.",
    options: [
      { text: "«Боль — решение — результат»", correct: true },
      { text: "Говорить языком пользы для пациента", correct: true },
      { text: "Визуализация: графики, таблицы, упаковки", correct: true },
      { text: "Открыто ругать конкурента, называя его плохим", correct: false },
    ],
  },
  {
    type: "TRUE_FALSE",
    text: "По «золотым правилам» медпреду стоит прямо спрашивать врача: «Будете назначать наш препарат?»",
    explanation: "Одно из правил «не делай»: не спрашивать в лоб про назначение — такие вопросы получают закрытые ответы.",
    options: [
      { text: "Верно", correct: false },
      { text: "Неверно", correct: true },
    ],
  },
  {
    type: "TRUE_FALSE",
    text: "При сравнении с аналогами тренер советует указывать конкретные отличия, а не просто ругать конкурента.",
    explanation: "Техника «сравнение с аналогами»: сравнивай корректно — «у нас меньше побочных эффектов, проще режим», а не «плохой/хороший».",
    options: [
      { text: "Верно", correct: true },
      { text: "Неверно", correct: false },
    ],
  },
  {
    type: "SINGLE_CHOICE",
    text: "Чем является закрытие сделки по определению из курса?",
    explanation: "«Закрытие — это убеждающая техника и создание мостика для следующей встречи».",
    options: [
      { text: "Убеждающая техника и создание мостика к следующей встрече", correct: true },
      { text: "Подписание официального договора поставки", correct: false },
      { text: "Выставление счёта на оплату", correct: false },
      { text: "Передача врача другому менеджеру", correct: false },
    ],
  },
  {
    type: "SINGLE_CHOICE",
    text: "Что тренер называет первой составляющей успеха при продаже дорогого продукта?",
    explanation: "«Стопроцентная вера в его результат»: если вы верите в продукт — вам легче продавать его другим.",
    options: [
      { text: "Стопроцентная вера в результат продукта", correct: true },
      { text: "Самая низкая цена на рынке", correct: false },
      { text: "Большой штат менеджеров", correct: false },
      { text: "Агрессивная реклама в СМИ", correct: false },
    ],
  },
];

async function seedFinalExam(
  courseId: string,
  spec: { questions: SeedQuestion[]; description: string; passScore: number },
) {
  const existing = await db.quiz.findFirst({
    where: { courseId, kind: "FINAL_EXAM" },
    select: { id: true },
  });
  if (existing) return;

  const quiz = await db.quiz.create({
    data: {
      kind: "FINAL_EXAM",
      courseId,
      title: "Итоговый экзамен курса",
      description: spec.description,
      passScore: spec.passScore,
      status: "PUBLISHED",
    },
  });

  for (const [qi, q] of spec.questions.entries()) {
    await db.question.create({
      data: {
        quizId: quiz.id,
        type: q.type,
        text: q.text,
        explanation: q.explanation,
        points: 1,
        sortOrder: qi,
        origin: "MANUAL",
        validation: "VALIDATED",
        validatedAt: new Date(),
        options: {
          create: q.options.map((o, oi) => ({
            text: o.text,
            isCorrect: o.correct,
            sortOrder: oi,
            pairKey: o.pairKey ?? null,
          })),
        },
      },
    });
  }
}

/** Задания к отдельным урокам (LESSON_QUIZ) — тип подобран под содержание урока. */
async function seedLessonQuizzes(courseId: string, rows: LessonQuizSeed[]) {
  const lessons = await db.lesson.findMany({
    where: { module: { courseId } },
    select: { id: true, title: true },
  });
  for (const lq of rows) {
    const lesson = lessons.find((l) => l.title.includes(lq.lessonMatch));
    if (!lesson) continue;
    if (await db.quiz.findFirst({ where: { lessonId: lesson.id, kind: "LESSON_QUIZ" }, select: { id: true } })) continue;

    const quiz = await db.quiz.create({
      data: {
        kind: "LESSON_QUIZ",
        lessonId: lesson.id,
        title: lq.title,
        passScore: lq.passScore,
        status: "PUBLISHED",
      },
    });
    for (const [qi, q] of lq.questions.entries()) {
      await db.question.create({
        data: {
          quizId: quiz.id,
          type: q.type,
          text: q.text,
          explanation: q.explanation,
          points: 1,
          sortOrder: qi,
          origin: "MANUAL",
          validation: "VALIDATED",
          validatedAt: new Date(),
          options: {
            create: q.options.map((o, oi) => ({
              text: o.text,
              isCorrect: o.correct,
              sortOrder: oi,
              pairKey: o.pairKey ?? null,
            })),
          },
        },
      });
    }
  }
}

/** Конспекты уроков (AiArtifact SUMMARY) по реальному содержанию видео. */
async function seedSummaries(courseId: string, rows: LessonSummary[]) {
  const lessons = await db.lesson.findMany({
    where: { module: { courseId } },
    select: { id: true, title: true },
  });
  for (const ls of rows) {
    const lesson = lessons.find((l) => l.title.includes(ls.titleMatch));
    if (!lesson) continue;
    await db.aiArtifact.upsert({
      where: { lessonId_type: { lessonId: lesson.id, type: "SUMMARY" } },
      create: { lessonId: lesson.id, type: "SUMMARY", content: ls.summary, validation: "VALIDATED", criticScore: 100 },
      update: { content: ls.summary, validation: "VALIDATED" },
    });
  }
}

/** Презентации уроков (AiArtifact SLIDES) — JSON-колоды для просмотрщика. */
async function seedSlides(courseId: string, rows: LessonDeck[]) {
  const lessons = await db.lesson.findMany({
    where: { module: { courseId } },
    select: { id: true, title: true },
  });
  for (const ds of rows) {
    const lesson = lessons.find((l) => l.title.includes(ds.titleMatch));
    if (!lesson) continue;
    const content = JSON.stringify(ds.deck);
    await db.aiArtifact.upsert({
      where: { lessonId_type: { lessonId: lesson.id, type: "SLIDES" } },
      create: { lessonId: lesson.id, type: "SLIDES", content, validation: "VALIDATED", criticScore: 100 },
      update: { content, validation: "VALIDATED" },
    });
  }
}

/** Флеш-карточки уроков (AiArtifact FLASHCARDS) — тренажёр запоминания. */
async function seedFlashcards(courseId: string, rows: LessonFlashcards[]) {
  const lessons = await db.lesson.findMany({
    where: { module: { courseId } },
    select: { id: true, title: true },
  });
  for (const lf of rows) {
    const lesson = lessons.find((l) => l.title.includes(lf.titleMatch));
    if (!lesson) continue;
    const content = JSON.stringify({ cards: lf.cards });
    await db.aiArtifact.upsert({
      where: { lessonId_type: { lessonId: lesson.id, type: "FLASHCARDS" } },
      create: { lessonId: lesson.id, type: "FLASHCARDS", content, validation: "VALIDATED", criticScore: 100 },
      update: { content, validation: "VALIDATED" },
    });
  }
}

/** Тренажёры возражений уроков (AiArtifact OBJECTIONS) — интерактивная практика продаж. */
async function seedObjections(courseId: string, rows: LessonObjections[]) {
  const lessons = await db.lesson.findMany({
    where: { module: { courseId } },
    select: { id: true, title: true },
  });
  for (const lo of rows) {
    const lesson = lessons.find((l) => l.title.includes(lo.titleMatch));
    if (!lesson) continue;
    const content = JSON.stringify({ items: lo.items });
    await db.aiArtifact.upsert({
      where: { lessonId_type: { lessonId: lesson.id, type: "OBJECTIONS" } },
      create: { lessonId: lesson.id, type: "OBJECTIONS", content, validation: "VALIDATED", criticScore: 100 },
      update: { content, validation: "VALIDATED" },
    });
  }
}

/** Артефакт-форматы по titleMatch: чек-листы, скрипты, «найди ошибку», hotspot. */
async function seedArtifacts(
  courseId: string,
  type:
    | "CHECKLIST"
    | "SCRIPT_BUILDER"
    | "DIALOGUE_AUDIT"
    | "HOTSPOT"
    | "BRANCHING"
    | "TASK_METAPHOR"
    | "EISENHOWER"
    | "RULE_6040"
    | "SMART_GOAL"
    | "TIME_AUDIT"
    | "CLIENT_TYPES"
    | "STAGE_LADDER"
    | "OBJECTION_SCALE"
    | "NEEDS_CART",
  rows: { titleMatch: string; data: unknown }[],
) {
  const lessons = await db.lesson.findMany({
    where: { module: { courseId } },
    select: { id: true, title: true },
  });
  for (const row of rows) {
    const lesson = lessons.find((l) => l.title.includes(row.titleMatch));
    if (!lesson) continue;
    const content = JSON.stringify(row.data);
    await db.aiArtifact.upsert({
      where: { lessonId_type: { lessonId: lesson.id, type } },
      create: { lessonId: lesson.id, type, content, validation: "VALIDATED", criticScore: 100 },
      update: { content, validation: "VALIDATED" },
    });
  }
}

/** Сценарии диалог-симулятора (SimulationScenario) по titleMatch. */
async function seedScenarios(courseId: string, rows: LessonScenario[]) {
  const lessons = await db.lesson.findMany({
    where: { module: { courseId } },
    select: { id: true, title: true },
  });
  for (const s of rows) {
    const lesson = lessons.find((l) => l.title.includes(s.titleMatch));
    if (!lesson) continue;
    const exists = await db.simulationScenario.findFirst({
      where: { lessonId: lesson.id, title: s.title },
      select: { id: true },
    });
    if (exists) {
      await db.simulationScenario.update({
        where: { id: exists.id },
        data: {
          persona: s.persona,
          objectives: s.objectives,
          archetype: s.archetype,
          difficulty: s.difficulty,
          complianceRules: s.complianceRules,
          validation: "VALIDATED",
          criticScore: 100,
        },
      });
    } else {
      await db.simulationScenario.create({
        data: {
          lessonId: lesson.id,
          title: s.title,
          persona: s.persona,
          objectives: s.objectives,
          archetype: s.archetype,
          difficulty: s.difficulty,
          complianceRules: s.complianceRules,
          validation: "VALIDATED",
          criticScore: 100,
        },
      });
    }
  }
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

  const specs = SEED_COURSES.length > 0 ? COURSES.filter((x) => SEED_COURSES.includes(x.slug)) : COURSES;
  if (SEED_COURSES.length > 0) {
    const unknown = SEED_COURSES.filter((slug) => !COURSES.some((x) => x.slug === slug));
    if (unknown.length > 0) throw new Error(`SEED_COURSES: неизвестные курсы — ${unknown.join(", ")}`);
    console.log(`▶ Точечный сид: ${specs.map((x) => x.slug).join(", ")}`);
  }
  const courses = [];
  for (const spec of specs) {
    courses.push(await upsertCourse(spec));
  }

  // Медпред-курс собран полностью: публикуем все уроки, конспекты, экзамен.
  const pharmaCourse = courses.find((c) => c.slug === "sales-pharma");
  if (pharmaCourse) {
  await db.lesson.updateMany({
    where: { module: { courseId: pharmaCourse.id }, videoStatus: "READY" },
    data: { status: "PUBLISHED" },
  });
  // Первый урок — бесплатное превью
  const firstLesson = await db.lesson.findFirst({
    where: { module: { courseId: pharmaCourse.id } },
    orderBy: [{ module: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: { id: true },
  });
  if (firstLesson) {
    await db.lesson.update({ where: { id: firstLesson.id }, data: { isFreePreview: true } });
  }
  await seedSummaries(pharmaCourse.id, PHARMA_SUMMARIES);
  await seedSlides(pharmaCourse.id, PHARMA_SLIDES);
  await seedFlashcards(pharmaCourse.id, PHARMA_FLASHCARDS);
  await seedObjections(pharmaCourse.id, PHARMA_OBJECTIONS);
  await seedArtifacts(pharmaCourse.id, "CHECKLIST", PHARMA_CHECKLISTS);
  await seedArtifacts(pharmaCourse.id, "SCRIPT_BUILDER", PHARMA_SCRIPTS);
  await seedArtifacts(pharmaCourse.id, "DIALOGUE_AUDIT", PHARMA_AUDITS);
  await seedArtifacts(pharmaCourse.id, "HOTSPOT", PHARMA_HOTSPOTS);
  await seedArtifacts(pharmaCourse.id, "BRANCHING", PHARMA_BRANCHING);
  await seedScenarios(pharmaCourse.id, PHARMA_SCENARIOS);
  await seedFinalExam(pharmaCourse.id, {
    questions: PHARMA_EXAM,
    description: "Проверка знаний по техникам продаж для медицинских представителей.",
    passScore: 80,
  });
  await seedLessonQuizzes(pharmaCourse.id, PHARMA_LESSON_QUIZZES);

  // ── Курс «B2B-переговоры и крупные сделки» ────────────────────────────────
  // Итоговый тест готов (авторские материалы тренера). Поурочный контент
  // (конспекты, слайды, задания, тренажёры) добавляется по одному уроку —
  // после появления видео, см. prisma/seed-data/b2b-content.ts.
  }

  const b2bCourse = courses.find((c) => c.slug === "sales-b2b");
  if (b2bCourse) {
  await seedSummaries(b2bCourse.id, B2B_SUMMARIES);
  await seedSlides(b2bCourse.id, B2B_SLIDES);
  await seedFlashcards(b2bCourse.id, B2B_FLASHCARDS);
  await seedObjections(b2bCourse.id, B2B_OBJECTIONS);
  await seedArtifacts(b2bCourse.id, "CHECKLIST", B2B_CHECKLISTS);
  await seedArtifacts(b2bCourse.id, "SCRIPT_BUILDER", B2B_SCRIPTS);
  await seedArtifacts(b2bCourse.id, "DIALOGUE_AUDIT", B2B_AUDITS);
  await seedArtifacts(b2bCourse.id, "HOTSPOT", B2B_HOTSPOTS);
  await seedArtifacts(b2bCourse.id, "BRANCHING", B2B_BRANCHING);
  await seedScenarios(b2bCourse.id, B2B_SCENARIOS);
  await seedFinalExam(b2bCourse.id, {
    questions: B2B_EXAM,
    description: "Проверка знаний по урокам курса: проактивная подготовка, ЛПР и воронка, четыре типа переговоров, VIP и СПИН.",
    passScore: B2B_EXAM_PASS_SCORE,
  });
  await seedLessonQuizzes(b2bCourse.id, B2B_LESSON_QUIZZES);
  // Уроки с готовым HLS публикуем: контент к ним собран (конспект, слайды, задания).
  await db.lesson.updateMany({
    where: { module: { courseId: b2bCourse.id }, videoStatus: "READY" },
    data: { status: "PUBLISHED" },
  });
  }

  // ── Курс «Эффективные продажи кухонь 2.0» ─────────────────────────────────
  // Контент по видео Виталия Дубовика (транскрипты в «Презентации/Кухни 2.0»),
  // см. prisma/seed-data/kitchen-content.ts. Презентации уроков — PDF-раздатки
  // (factory:handout + factory:slides-import), поэтому JSON-колод здесь нет.
  const kitchenCourse = courses.find((c) => c.slug === "sales-kitchens");
  if (kitchenCourse) {
    await seedSummaries(kitchenCourse.id, KITCHEN_SUMMARIES);
    await seedLessonQuizzes(kitchenCourse.id, KITCHEN_LESSON_QUIZZES);
    await seedFlashcards(kitchenCourse.id, KITCHEN_FLASHCARDS);
    await seedObjections(kitchenCourse.id, KITCHEN_OBJECTIONS);
    await seedArtifacts(kitchenCourse.id, "CHECKLIST", KITCHEN_CHECKLISTS);
    await seedArtifacts(kitchenCourse.id, "SCRIPT_BUILDER", KITCHEN_SCRIPTS);
    await seedArtifacts(kitchenCourse.id, "DIALOGUE_AUDIT", KITCHEN_AUDITS);
    await seedArtifacts(kitchenCourse.id, "BRANCHING", KITCHEN_BRANCHING);
    await seedScenarios(kitchenCourse.id, KITCHEN_SCENARIOS);
    await seedFinalExam(kitchenCourse.id, {
      questions: KITCHEN_EXAM,
      description:
        "Проверка знаний по курсу: рынок кухонь, работа с лидами и звонками, чек-лист дизайнера, психология покупателя, потребности, возражения, конфликты и завершение сделки.",
      passScore: KITCHEN_EXAM_PASS_SCORE,
    });
    await db.lesson.updateMany({
      where: { module: { courseId: kitchenCourse.id }, videoStatus: "READY" },
      data: { status: "PUBLISHED" },
    });
  }

  // ── Курс «СПИН-продажи: как формировать потребность» ──────────────────────
  // Контент по видео Виталия Дубовика (транскрипты в «Презентации/СПИН-продажи»),
  // см. prisma/seed-data/spin-content.ts.
  const spinCourse = courses.find((c) => c.slug === "sales-spin");
  if (spinCourse) {
    await seedSummaries(spinCourse.id, SPIN_SUMMARIES);
    await seedSlides(spinCourse.id, SPIN_SLIDES);
    await seedLessonQuizzes(spinCourse.id, SPIN_LESSON_QUIZZES);
    await seedFlashcards(spinCourse.id, SPIN_FLASHCARDS);
    await seedObjections(spinCourse.id, SPIN_OBJECTIONS);
    await seedArtifacts(spinCourse.id, "CHECKLIST", SPIN_CHECKLISTS);
    await seedArtifacts(spinCourse.id, "SCRIPT_BUILDER", SPIN_SCRIPTS);
    await seedArtifacts(spinCourse.id, "DIALOGUE_AUDIT", SPIN_AUDITS);
    await seedArtifacts(spinCourse.id, "HOTSPOT", SPIN_HOTSPOTS);
    await seedArtifacts(spinCourse.id, "BRANCHING", SPIN_BRANCHING);
    await seedScenarios(spinCourse.id, SPIN_SCENARIOS);
    await seedFinalExam(spinCourse.id, {
      questions: SPIN_EXAM,
      description:
        "Проверка знаний по курсу: четыре вида вопросов СПИН, схема «факт → выгода → согласие» и перенос метода на розницу, B2B, финансы, услуги и бытовые переговоры.",
      passScore: SPIN_EXAM_PASS_SCORE,
    });
    // Уроки с готовым HLS публикуем: поурочный контент к ним собран.
    await db.lesson.updateMany({
      where: { module: { courseId: spinCourse.id }, videoStatus: "READY" },
      data: { status: "PUBLISHED" },
    });
  }

  // ── Курс «Продажи в магазине обуви и одежды» ──────────────────────────────
  // Контент собран по реальному содержанию видео Виталия Дубовика (транскрипты в
  // «Презентации/Продажи обуви»), см. prisma/seed-data/shoes-content.ts.
  const shoesCourse = courses.find((c) => c.slug === "sales-shoes");
  if (shoesCourse) {
    await seedSummaries(shoesCourse.id, SHOES_SUMMARIES);
    await seedSlides(shoesCourse.id, SHOES_SLIDES);
    await seedLessonQuizzes(shoesCourse.id, SHOES_LESSON_QUIZZES);
    await seedFlashcards(shoesCourse.id, SHOES_FLASHCARDS);
    await seedObjections(shoesCourse.id, SHOES_OBJECTIONS);
    await seedArtifacts(shoesCourse.id, "CHECKLIST", SHOES_CHECKLISTS);
    await seedArtifacts(shoesCourse.id, "SCRIPT_BUILDER", SHOES_SCRIPTS);
    await seedArtifacts(shoesCourse.id, "DIALOGUE_AUDIT", SHOES_AUDITS);
    await seedArtifacts(shoesCourse.id, "HOTSPOT", SHOES_HOTSPOTS);
    await seedArtifacts(shoesCourse.id, "BRANCHING", SHOES_BRANCHING);
    await seedScenarios(shoesCourse.id, SHOES_SCENARIOS);
    await seedFinalExam(shoesCourse.id, {
      questions: SHOES_EXAM,
      description:
        "Проверка знаний по курсу: контакт в торговом зале, выявление потребности, презентация и три коробки, работа с возражениями, расширение чека, методы завершения и типичные ошибки.",
      passScore: SHOES_EXAM_PASS_SCORE,
    });
    // Уроки с готовым HLS публикуем: поурочный контент к ним собран.
    await db.lesson.updateMany({
      where: { module: { courseId: shoesCourse.id }, videoStatus: "READY" },
      data: { status: "PUBLISHED" },
    });
  }

  // ── Курс «Техники продаж в туризме» ──────────────────────────────────────
  // Контент по видео Виталия Дубовика (транскрипты в «Презентации/Техники продаж
  // в туризме»), см. prisma/seed-data/tourism-content.ts. Раздатки уроков — PDF
  // (factory:handout + factory:publish), поэтому здесь только колоды кабинета.
  const tourismCourse = courses.find((c) => c.slug === "sales-tourism");
  if (tourismCourse) {
    await seedSummaries(tourismCourse.id, TOURISM_SUMMARIES);
    await seedSlides(tourismCourse.id, TOURISM_SLIDES);
    await seedLessonQuizzes(tourismCourse.id, TOURISM_LESSON_QUIZZES);
    await seedFlashcards(tourismCourse.id, TOURISM_FLASHCARDS);
    await seedObjections(tourismCourse.id, TOURISM_OBJECTIONS);
    await seedArtifacts(tourismCourse.id, "CHECKLIST", TOURISM_CHECKLISTS);
    await seedArtifacts(tourismCourse.id, "SCRIPT_BUILDER", TOURISM_SCRIPTS);
    await seedArtifacts(tourismCourse.id, "DIALOGUE_AUDIT", TOURISM_AUDITS);
    await seedArtifacts(tourismCourse.id, "HOTSPOT", TOURISM_HOTSPOTS);
    await seedArtifacts(tourismCourse.id, "BRANCHING", TOURISM_BRANCHING);
    await seedArtifacts(tourismCourse.id, "CLIENT_TYPES", TOURISM_CLIENT_TYPES);
    await seedScenarios(tourismCourse.id, TOURISM_SCENARIOS);
    await seedFinalExam(tourismCourse.id, {
      questions: TOURISM_EXAM,
      description:
        "Проверка знаний по курсу: что покупает турист, четыре вида продавца, цикл сделки, зоны опасности, алгоритм звонка, воронка вопросов, типы туристов, возражения, конфликт и закрытие сделки.",
      passScore: TOURISM_EXAM_PASS_SCORE,
    });
    // Уроки с готовым HLS публикуем: поурочный контент к ним собран.
    await db.lesson.updateMany({
      where: { module: { courseId: tourismCourse.id }, videoStatus: "READY" },
      data: { status: "PUBLISHED" },
    });
  }

  // ── Курс «Техники продаж недвижимости» ───────────────────────────────────
  // Контент по видео Виталия Дубовика (транскрипты в «Презентации/Техники продаж
  // недвижимости»), см. prisma/seed-data/realty-content.ts. Раздатки уроков — PDF
  // (factory:handout + factory:publish), поэтому здесь только колоды кабинета.
  const realtyCourse = courses.find((c) => c.slug === "sales-realty");
  if (realtyCourse) {
    await seedSummaries(realtyCourse.id, REALTY_SUMMARIES);
    await seedSlides(realtyCourse.id, REALTY_SLIDES);
    await seedLessonQuizzes(realtyCourse.id, REALTY_LESSON_QUIZZES);
    await seedFlashcards(realtyCourse.id, REALTY_FLASHCARDS);
    await seedObjections(realtyCourse.id, REALTY_OBJECTIONS);
    await seedArtifacts(realtyCourse.id, "CHECKLIST", REALTY_CHECKLISTS);
    await seedArtifacts(realtyCourse.id, "SCRIPT_BUILDER", REALTY_SCRIPTS);
    await seedArtifacts(realtyCourse.id, "DIALOGUE_AUDIT", REALTY_AUDITS);
    await seedArtifacts(realtyCourse.id, "HOTSPOT", REALTY_HOTSPOTS);
    await seedArtifacts(realtyCourse.id, "BRANCHING", REALTY_BRANCHING);
    await seedScenarios(realtyCourse.id, REALTY_SCENARIOS);
    await seedFinalExam(realtyCourse.id, {
      questions: REALTY_EXAM,
      description:
        "Проверка знаний по курсу: ценность услуги риэлтора, айсберг решения о продаже, тактика трёх шагов и шесть типичных ошибок — лень, «слив» квартиры, манипуляции, потребности, возражения и репутация.",
      passScore: REALTY_EXAM_PASS_SCORE,
    });
    // Уроки с готовым HLS публикуем: поурочный контент к ним собран.
    await db.lesson.updateMany({
      where: { module: { courseId: realtyCourse.id }, videoStatus: "READY" },
      data: { status: "PUBLISHED" },
    });
  }

  // ── Курс «Тайм менеджмент: базовые принципы» ──────────────────────────────
  // Поурочные задания, флеш-карты, тренажёры и итоговый экзамен — по реальному
  // содержанию видео Виталия Дубовика, см. prisma/seed-data/time-content.ts.
  const timeCourse = courses.find((c) => c.slug === "time-management");
  if (timeCourse) {
    await seedLessonQuizzes(timeCourse.id, TIME_LESSON_QUIZZES);
    await seedFlashcards(timeCourse.id, TIME_FLASHCARDS);
    await seedArtifacts(timeCourse.id, "CHECKLIST", TIME_CHECKLISTS);
    await seedArtifacts(timeCourse.id, "SCRIPT_BUILDER", TIME_SCRIPTS);
    await seedArtifacts(timeCourse.id, "BRANCHING", TIME_BRANCHING);
    await seedArtifacts(timeCourse.id, "TASK_METAPHOR", TIME_METAPHORS);
    await seedArtifacts(timeCourse.id, "EISENHOWER", TIME_EISENHOWER);
    await seedArtifacts(timeCourse.id, "RULE_6040", TIME_RULE6040);
    await seedArtifacts(timeCourse.id, "SMART_GOAL", TIME_SMART);
    await seedArtifacts(timeCourse.id, "TIME_AUDIT", TIME_AUDIT);
    await seedFinalExam(timeCourse.id, {
      questions: TIME_EXAM,
      description:
        "Проверка знаний по курсу: приоритеты и матрица Эйзенхауэра, правило 60/40, лягушка/слон/три гвоздя, цели по SMART, ежедневник и хронометраж.",
      passScore: TIME_EXAM_PASS_SCORE,
    });
  }

  // ── Курс «Продажи в DIY-магазине» ────────────────────────────────────────
  // Контент по видео Виталия Дубовика (транскрипты в «Презентации/Продажи DIY»),
  // см. prisma/seed-data/diy-content.ts. Раздатки уроков — PDF (factory:handout).
  const diyCourse = courses.find((c) => c.slug === "sales-diy");
  if (diyCourse) {
    await seedSummaries(diyCourse.id, DIY_SUMMARIES);
    await seedSlides(diyCourse.id, DIY_SLIDES);
    await seedLessonQuizzes(diyCourse.id, DIY_LESSON_QUIZZES);
    await seedFlashcards(diyCourse.id, DIY_FLASHCARDS);
    await seedObjections(diyCourse.id, DIY_OBJECTIONS);
    await seedArtifacts(diyCourse.id, "CHECKLIST", DIY_CHECKLISTS);
    await seedArtifacts(diyCourse.id, "SCRIPT_BUILDER", DIY_SCRIPTS);
    await seedArtifacts(diyCourse.id, "DIALOGUE_AUDIT", DIY_AUDITS);
    await seedArtifacts(diyCourse.id, "BRANCHING", DIY_BRANCHING);
    await seedArtifacts(diyCourse.id, "CLIENT_TYPES", DIY_CLIENT_TYPES);
    await seedArtifacts(diyCourse.id, "STAGE_LADDER", DIY_LADDER);
    await seedArtifacts(diyCourse.id, "NEEDS_CART", DIY_CART);
    await seedArtifacts(diyCourse.id, "OBJECTION_SCALE", DIY_SCALE);
    await seedScenarios(diyCourse.id, DIY_SCENARIOS);
    await seedFinalExam(diyCourse.id, {
      questions: DIY_EXAM,
      description:
        "Проверка знаний по курсу: пять этапов продажи, роли продавца, три психотипа покупателя (синий, зелёный, красный) и работа с возражениями без оправданий.",
      passScore: DIY_EXAM_PASS_SCORE,
    });
    // Уроки с готовым HLS публикуем: поурочный контент к ним собран.
    await db.lesson.updateMany({
      where: { module: { courseId: diyCourse.id }, videoStatus: "READY" },
      data: { status: "PUBLISHED" },
    });
  }

  // Отзывы для курса медпреда (VALIDATED — видны на лендинге)
  const existingReviews = pharmaCourse ? await db.review.count({ where: { courseId: pharmaCourse.id } }) : -1;
  if (pharmaCourse && existingReviews === 0) {
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
