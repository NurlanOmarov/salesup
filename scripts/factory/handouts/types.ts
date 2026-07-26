/**
 * Формат колод для PDF-раздаток уроков (factory:handout).
 *
 * Это НЕ формат презентаций в кабинете (src/lib/slides.ts, AiArtifact SLIDES):
 * раздатка печатается в PDF и живёт рядом с транскриптом в «Презентации/<Курс>/»,
 * поэтому у неё свои макеты — плотнее, с матрицами, схемами и итоговым разворотом.
 * Фирменный стиль ACTIVE SALES описан в docs/PRESENTATIONS.md.
 */

/** Тон карточки: светлая (по умолчанию), тёмная, красная-акцент, пунктирная. */
export type Tone = "light" | "dark" | "red" | "dashed";

export interface CoverSlide {
  layout: "cover";
  kicker: string;
  title: string;
  subtitle?: string;
  /**
   * Фото тренера в правой колонке (по умолчанию да). Это ЕДИНСТВЕННОЕ место
   * в колоде, где оно появляется: правило фирменного стиля — одно фото на раздатку.
   */
  photo?: boolean;
}

/** Крупное утверждение: заголовок с красным выделением + абзац пояснения. */
export interface StatementSlide {
  layout: "statement";
  kicker: string;
  title: string;
  /** Часть заголовка, которую подсветить красным (подстрока title). */
  highlight?: string;
  text?: string;
  /** Крупная светло-серая цифра/символ в правом верхнем углу. */
  watermark?: string;
}

export interface CardsSlide {
  layout: "cards";
  kicker: string;
  title: string;
  intro?: string;
  columns?: 2 | 3;
  items: { title?: string; text: string; tone?: Tone }[];
  /** Красная плашка-цитата под карточками. */
  banner?: string;
}

/** Нумерованный список 01…N в одну или две колонки. */
export interface NumberedSlide {
  layout: "numbered";
  kicker: string;
  title: string;
  intro?: string;
  columns?: 1 | 2;
  items: { lead: string; text?: string }[];
  banner?: string;
}

/** Плашки-строки с номерами; последняя может быть красной. */
export interface StripsSlide {
  layout: "strips";
  kicker: string;
  title: string;
  items: string[];
  accentLast?: boolean;
  banner?: string;
}

/** Две колонки-сравнения: «работает / не работает», «было / стало», вопросы и презентация. */
export interface SplitSlide {
  layout: "split";
  kicker: string;
  title: string;
  left: { heading: string; tone?: "good" | "bad" | "neutral"; items: string[] };
  right: { heading: string; tone?: "good" | "bad" | "neutral"; items: string[] };
  banner?: string;
}

/** Матрица 2×2 (четыре карточки равного веса). */
export interface MatrixSlide {
  layout: "matrix";
  kicker: string;
  title: string;
  quadrants: { label: string; title: string; text?: string; tone?: Tone }[];
}

/** Слайд-схема: инлайновый SVG из public/ + подписи-выноски рядом. */
export interface FigureSlide {
  layout: "figure";
  kicker: string;
  title: string;
  /** Путь относительно корня репозитория, напр. public/images/shoes/boot-anatomy.svg */
  svg: string;
  caption?: string;
  notes?: { label: string; text: string }[];
}

export interface QuoteSlide {
  layout: "quote";
  kicker?: string;
  text: string;
  author?: string;
}

/** Итоговый тёмный разворот. */
export interface SummarySlide {
  layout: "summary";
  kicker: string;
  title: string;
  items: string[];
  accentLast?: boolean;
}

export type HandoutSlide =
  | CoverSlide
  | StatementSlide
  | CardsSlide
  | NumberedSlide
  | StripsSlide
  | SplitSlide
  | MatrixSlide
  | FigureSlide
  | QuoteSlide
  | SummarySlide;

export interface HandoutDeck {
  /** Подпапка урока в «Презентации/<Курс>/», напр. «02-Установление контакта». */
  dir: string;
  /** Имя PDF без расширения. */
  file: string;
  slides: HandoutSlide[];
}

export interface CourseHandout {
  /** Slug курса (совпадает с Course.slug). */
  slug: string;
  /** Папка курса внутри «Презентации/». */
  folder: string;
  /** Подпись в футере слайдов. */
  courseTitle: string;
  decks: HandoutDeck[];
}
