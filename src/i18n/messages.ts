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
  course: {
    home: "Главная",
    courses: "Курсы",
    about: "О курсе",
    forWhom: "Для кого этот курс",
    whatYouGet: "Что вы получите",
    program: "Программа курса",
    reviews: "Отзывы",
    faq: "Частые вопросы",
    related: "Связанные курсы",
    relatedNote: "Программы по смежным темам — усильте навыки продаж.",
    trainer: "Ваш тренер",
    trainerMore: "Подробнее о тренере →",
    free: "Бесплатно",
    noOnlinePayment: "Онлайн-оплата не требуется",
    lifetime: "Пожизненный доступ",
    certificate: "Сертификат по окончании",
    subtitles: "Субтитры на 4 языках",
    writeWhatsapp: "Написать в WhatsApp",
    writeTelegram: "Написать в Telegram",
  },
  lead: {
    sent: "Заявка отправлена!",
    sentOffline: "Свяжемся, обсудим программу, даты и стоимость тренинга.",
    sentB2b: "Свяжемся в ближайшее время, посчитаем стоимость и выставим счёт.",
    sentB2c: "Мы свяжемся с вами в ближайшее время и расскажем, как начать обучение.",
    namePlaceholder: "Как к вам обращаться",
    company: "Организация",
    companyPlaceholder: "Название компании",
    participants: "Сколько участников",
    employees: "Сколько сотрудников обучаем",
    contact: "Телефон, WhatsApp или e-mail *",
    comment: "Комментарий",
    commentOffline: "Город, желаемые даты, задачи тренинга",
    commentB2b: "Отрасль, задачи обучения",
    commentB2c: "Какой курс интересует",
    consentBefore: "Я согласен(-на) на обработку моих персональных данных на условиях",
    consentPrivacy: "Политики обработки персональных данных",
    consentMiddle: "(включая трансграничную передачу) и принимаю условия",
    consentOfferB2b: "публичной оферты для организаций",
    consentOffer: "публичной оферты",
    submitting: "Отправляем…",
    submitOffline: "Отправить запрос",
    submitB2b: "Получить расчёт",
    submitB2c: "Оставить заявку",
  },
  cta: {
    enroll: "Записаться на курс",
    enrolled: "Вы уже записаны на этот курс",
    accessActive: "Доступ активен — продолжайте обучение в личном кабинете.",
    continue: "Продолжить обучение",
    myLearning: "Моё обучение",
    manualAccess: "Доступ выдаётся вручную после подтверждения оплаты.",
    leaveRequest:
      "Оставьте заявку — расскажем об условиях, подберём удобный способ оплаты и откроем доступ.",
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
  course: {
    home: "Басты бет",
    courses: "Курстар",
    about: "Курс туралы",
    forWhom: "Бұл курс кімге арналған",
    whatYouGet: "Не аласыз",
    program: "Курс бағдарламасы",
    reviews: "Пікірлер",
    faq: "Жиі қойылатын сұрақтар",
    related: "Ұқсас курстар",
    relatedNote: "Сабақтас тақырыптардағы бағдарламалар — сату дағдыңызды күшейтіңіз.",
    trainer: "Сіздің тренеріңіз",
    trainerMore: "Тренер туралы толығырақ →",
    free: "Тегін",
    noOnlinePayment: "Онлайн төлеудің қажеті жоқ",
    lifetime: "Мәңгілік қолжетімділік",
    certificate: "Аяқтағаннан кейін сертификат",
    subtitles: "4 тілде субтитрлер",
    writeWhatsapp: "WhatsApp-қа жазу",
    writeTelegram: "Telegram-ға жазу",
  },
  lead: {
    sent: "Өтінім жіберілді!",
    sentOffline: "Хабарласып, бағдарламаны, күндерді және тренинг құнын талқылаймыз.",
    sentB2b: "Жақын арада хабарласып, құнын есептеп, шот ұсынамыз.",
    sentB2c: "Жақын арада хабарласып, оқуды қалай бастау керегін айтамыз.",
    namePlaceholder: "Сізге қалай жүгінейік",
    company: "Ұйым",
    companyPlaceholder: "Компания атауы",
    participants: "Қанша қатысушы",
    employees: "Қанша қызметкерді оқытамыз",
    contact: "Телефон, WhatsApp немесе e-mail *",
    comment: "Пікір",
    commentOffline: "Қала, қалаған күндер, тренинг міндеттері",
    commentB2b: "Сала, оқыту міндеттері",
    commentB2c: "Қай курс қызықтырады",
    consentBefore: "Дербес деректерімнің өңделуіне келесі шарттармен келісемін:",
    consentPrivacy: "Дербес деректерді өңдеу саясаты",
    consentMiddle: "(трансшекаралық беруді қоса алғанда) және шарттарын қабылдаймын:",
    consentOfferB2b: "ұйымдарға арналған жария оферта",
    consentOffer: "жария оферта",
    submitting: "Жіберілуде…",
    submitOffline: "Сұраныс жіберу",
    submitB2b: "Есеп алу",
    submitB2c: "Өтінім қалдыру",
  },
  cta: {
    enroll: "Курсқа жазылу",
    enrolled: "Сіз бұл курсқа жазылғансыз",
    accessActive: "Қолжетімділік ашық — оқуды жеке кабинетте жалғастырыңыз.",
    continue: "Оқуды жалғастыру",
    myLearning: "Менің оқуым",
    manualAccess: "Қолжетімділік төлем расталғаннан кейін қолмен беріледі.",
    leaveRequest:
      "Өтінім қалдырыңыз — шарттарды айтып, ыңғайлы төлем тәсілін таңдап, қолжетімділік ашамыз.",
  },
} as const satisfies UiMessages;

const MESSAGES: Record<Locale, UiMessages> = { ru, kk };

/** Строки интерфейса на указанном языке (для клиентских компонентов — с useLocale). */
export function messagesFor(locale: Locale): UiMessages {
  return MESSAGES[locale] ?? MESSAGES.ru;
}
