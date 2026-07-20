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

/**
 * Сиды для локальной разработки (BACKLOG P0.3).
 * Учебный контент (HLS-видео/тесты/транскрипты) создаёт фабрика, не сид.
 */
const db = new PrismaClient();

/**
 * Точечный режим для прода (иначе сид затирает правки админки).
 *   SEED_COURSES=sales-b2b   — обрабатывать только перечисленные курсы (через запятую)
 *   SEED_PRESERVE_COURSE=1   — НЕ трогать поля существующего курса (цена, обложка,
 *                              описание правятся в админке); создавать только
 *                              недостающие модули/уроки и учебный контент
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
  // ── Прочие курсы (каркасы, контент собирает фабрика) ──────────────────────
  {
    slug: "sales-tourism",
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
    subtitle: "Как увеличить средний чек и конверсию в торговом зале",
    description:
      "Курс для продавцов-консультантов и администраторов розничных магазинов. Техника встречи, работа с ценовыми возражениями, допродажи аксессуаров и формирование лояльности покупателей.",
    industry: "Обувь и одежда",
    priceTiyn: 240_000,
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
  // SEED_PRESERVE_COURSE: существующий курс не трогаем — его поля ведёт админка.
  if (SEED_PRESERVE_COURSE) {
    const existing = await db.course.findUnique({ where: { slug: spec.slug }, select: { id: true, slug: true } });
    if (existing) {
      console.log(`   курс ${spec.slug}: поля сохранены (SEED_PRESERVE_COURSE=1)`);
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

  await createMissingModules(course.id, spec);

  return course;
}

/** Создать модули и уроки курса, если их ещё нет (существующие не трогаем). */
async function createMissingModules(courseId: string, spec: CourseSpec) {
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
  type: "CHECKLIST" | "SCRIPT_BUILDER" | "DIALOGUE_AUDIT" | "HOTSPOT" | "BRANCHING",
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
