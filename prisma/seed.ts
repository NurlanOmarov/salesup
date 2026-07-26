import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password.js";
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
  /** Ось витрины «для кого»: EVERYONE — универсальный, SPECIALIZED — под отрасль (по умолчанию). */
  audience?: "EVERYONE" | "SPECIALIZED";
  priceTiyn: number;
  oldPriceTiyn?: number;
  hoursLabel: string;
  inDevelopment?: boolean; // бейдж «В разработке» на витрине (каркасы без контента)
  learnPoints: string[];
  targetAudience: string[];
  faq: { q: string; a: string }[];
  modules: ModuleSpec[];
  coverUrl?: string;
};

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

const COURSES: CourseSpec[] = [
  {
    slug: "sales-pharma",
    title: "Активные продажи для медицинских представителей",
    subtitle: "Техники работы с врачами и аптеками в фармацевтическом бизнесе",
    description:
      "Видеокурс для медицинских представителей, региональных менеджеров и сотрудников фармацевтических компаний. 15 практических уроков по выявлению потребностей, работе с конкурентами, убеждению и закрытию сделок. Методика СПИН, разбор конфликтных ситуаций, 3 золотых правила медпреда. Все уроки записаны практикующим бизнес-тренером по продажам.",
    industry: "Медпредставители",
    priceTiyn: 300_000,
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
    priceTiyn: 300_000,
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
  // ── Прочие курсы (каркасы, контент собирает фабрика) ──────────────────────
  {
    slug: "sales-tourism",
    inDevelopment: true,
    title: "Техники продаж в туризме",
    subtitle: "Как продавать туры дорого и без скидок",
    description:
      "Базовый курс для турагентов и менеджеров туроператоров. Разбираем, как вести клиента от первого звонка до повторной покупки: работа с возражениями «дорого», «подумаю», «сравниваю», защита цены, допродажи.",
    industry: "Туризм",
    priceTiyn: 300_000,
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
    inDevelopment: true,
    title: "Эффективные продажи кухонь",
    subtitle: "Системный подход к продаже мебели в шоу-руме",
    description:
      "Практический курс для продавцов и управляющих мебельных салонов. Весь цикл продажи кухни: встреча у входа, выяснение бюджета, презентация, финальное закрытие без скидок.",
    industry: "Мебель и кухни",
    priceTiyn: 300_000,
    oldPriceTiyn: 480_000,
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
    subtitle: "Семь этапов продажи в торговом зале: от контакта до второй пары",
    description:
      "Практический видеокурс для продавцов-консультантов обувных и одёжных салонов от бизнес-тренера Виталия Дубовика (activesales.by). Пять уроков — весь цикл работы с покупателем в зале: как позиционироваться в торговом зале и поймать момент для подхода, какими вопросами выявлять потребность, как делать презентацию на языке выгод и правильно выносить три коробки, как отвечать на «дорого», «я просто смотрю», «боюсь неизвестный бренд» и «я подумаю», как расширять чек второй парой и уходом за обувью, восемь способов завершить продажу и 13 типичных ошибок продавца обуви, из-за которых покупатель уходит без покупки.",
    industry: "Обувь и одежда",
    priceTiyn: 240_000,
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
  },
  {
    slug: "sales-realty",
    inDevelopment: true,
    title: "Техники продаж недвижимости",
    subtitle: "От первого звонка до подписания договора",
    description:
      "Специализированный курс для риэлторов и менеджеров застройщиков. Полный цикл сделки: холодный звонок, показ объекта, переговоры о цене, работа с юридическими сомнениями клиента.",
    industry: "Недвижимость",
    priceTiyn: 360_000,
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
    inDevelopment: true,
    title: "B2B-переговоры и крупные сделки",
    subtitle: "Давление, торг и работа с ЛПР: переговоры как управляемый процесс",
    description:
      "Живой тренинг бизнес-тренера Виталия Дубовика по деловым переговорам в B2B. Четыре урока: проактивная подготовка вместо реакции на рынок, карта ролей в компании клиента (ЛПР и ЛВР) и математика воронки, четыре типа переговоров — «железо, бронза, серебро, золото» — с разбором 11 тактик манипуляции, и правила VIP-переговоров с методикой СПИН. В конце — итоговый тест на 20 вопросов по содержанию уроков.",
    industry: "B2B-переговоры",
    priceTiyn: 360_000,
    oldPriceTiyn: 540_000,
    hoursLabel: "~28 минут",
    learnPoints: [
      "Проактивный подход: готовиться к переговорам вместо реакции «дали — взял»",
      "ЛПР и ЛВР: кто говорит «да», когда все говорят «нет», и правило 2Н — нужные вопросы нужным людям",
      "Воронка от незнакомца до адвоката бренда и честная математика отказов (конверсия 1–3%)",
      "Четыре типа переговоров: железо (давление), бронза (торг), серебро (консультация), золото (партнёрство)",
      "11 тактик манипуляции оппонента и как им не поддаться: пауза, парковка возражения, красивый уход",
      "План обмена: как размениваться переменными сделки, а не отдавать скидку",
      "VIP-переговоры: свобода решения, «назови мотив хода», косвенные вопросы и накопление согласия",
      "Методика СПИН: ситуационные → проблемные → извлекающие → направляющие вопросы",
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
        q: "Примеры в видео — про поставки в рестораны. Подойдёт ли курс другой сфере?",
        a: "Да. Тренинг снят на аудитории поставщиков HoReCa, но все модели — ЛПР/ЛВР, типы переговоров, тактики манипуляции, СПИН — универсальны. Конспекты и задания курса даны на нейтральных B2B-примерах.",
      },
    ],
    // Структура собрана ПО РЕАЛЬНОМУ содержанию плейлиста (4 части живого тренинга,
    // https://youtube.com/playlist?list=PLPVUOXpAlSF4), а не по блокам презентации:
    // темы видео с ними совпадают лишь частично. Пятый ролик плейлиста (полная
    // 25-минутная версия, age-restricted) в курс намеренно не включён.
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

  const course = await db.course.upsert({
    where: { slug: spec.slug },
    update: {
      title: spec.title,
      subtitle: spec.subtitle,
      description: spec.description,
      industry: spec.industry,
      audience: spec.audience ?? "SPECIALIZED",
      priceTiyn: spec.priceTiyn,
      oldPriceTiyn: spec.oldPriceTiyn ?? null,
      hoursLabel: spec.hoursLabel,
      status: "PUBLISHED",
      inDevelopment: spec.inDevelopment ?? false,
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
      audience: spec.audience ?? "SPECIALIZED",
      priceTiyn: spec.priceTiyn,
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

/** Создать модули и уроки курса, если их ещё нет (существующие не трогаем). */
async function createMissingModules(courseId: string, spec: CourseSpec) {
  await dropPlaceholderModules(courseId);
  const existingModules = await db.module.count({ where: { courseId } });
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
    | "TIME_AUDIT",
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
