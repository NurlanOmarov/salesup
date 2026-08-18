import type { Locale } from "./routing";
import type { Localized } from "@/content/localized";

/**
 * Строки интерфейса витрины (казахская версия, docs/MULTI-DOMAIN-PLAN.md).
 *
 * Здесь только UI: подписи навигации, кнопки, статусы пустых списков. Тексты
 * лендинга и каталога живут в src/content/*, метаданные — в /admin/seo.
 * Русский модуль — источник структуры: казахский обязан повторить его ключи,
 * это проверяет тип UiMessages.
 */
const ru = {
  header: {
    tagline: "бизнес-тренинги для менеджеров",
    courses: "Курсы",
    login: "Войти",
  },
  audience: {
    self: "Себе",
    team: "Команде",
  },
  footer: {
    about: "Онлайн-курсы по продажам с AI-наставником.",
    navigation: "Навигация",
    home: "Главная",
    catalog: "Каталог курсов",
    business: "Обучение для компаний",
    studentLogin: "Вход для учеников",
    contacts: "Контакты",
    documents: "Документы",
    offer: "Оферта для физических лиц",
    offerB2b: "Оферта для организаций",
    privacy: "Обработка персональных данных",
    rights: "Все права защищены.",
    unp: "УНП",
  },
  catalog: {
    all: "Все",
    forEveryone: "Для всех",
    emptyTitle: "В этом направлении пока нет курсов",
    emptyText: "Скоро добавим — загляните в другие категории.",
    filterLabel: "Фильтр курсов по направлению",
  },
  language: {
    label: "Тіл / Язык",
    ru: "Русский",
    kk: "Қазақша",
  },
} as const;

export type UiMessages = Localized<typeof ru>;

const kk = {
  header: {
    tagline: "менеджерлерге арналған бизнес-тренингтер",
    courses: "Курстар",
    login: "Кіру",
  },
  audience: {
    self: "Өзіме",
    team: "Командаға",
  },
  footer: {
    about: "AI-тәлімгері бар сату бойынша онлайн-курстар.",
    navigation: "Навигация",
    home: "Басты бет",
    catalog: "Курстар каталогы",
    business: "Компанияларға арналған оқыту",
    studentLogin: "Оқушыларға кіру",
    contacts: "Байланыс",
    documents: "Құжаттар",
    offer: "Жеке тұлғаларға арналған оферта",
    offerB2b: "Ұйымдарға арналған оферта",
    privacy: "Дербес деректерді өңдеу",
    rights: "Барлық құқықтар қорғалған.",
    unp: "ЖТН",
  },
  catalog: {
    all: "Барлығы",
    forEveryone: "Барлығына",
    emptyTitle: "Бұл бағытта әзірге курстар жоқ",
    emptyText: "Жақында қосамыз — басқа санаттарды қараңыз.",
    filterLabel: "Курстарды бағыт бойынша сүзу",
  },
  language: {
    label: "Тіл / Язык",
    ru: "Русский",
    kk: "Қазақша",
  },
} as const satisfies UiMessages;

const MESSAGES: Record<Locale, UiMessages> = { ru, kk };

/** Строки интерфейса на указанном языке (для клиентских компонентов — с useLocale). */
export function messagesFor(locale: Locale): UiMessages {
  return MESSAGES[locale] ?? MESSAGES.ru;
}
