import { DEVICE_LIMIT } from "@/lib/antishare/limits";
import { pluralRu } from "@/lib/courses/plural";
import {
  bullets,
  button,
  card,
  credentialsBox,
  dataTable,
  note,
  para,
  sectionTitle,
  shell,
  steps,
  supportText,
  type SupportLink,
} from "@/lib/email/layout";

/**
 * Тексты писем платформы: покупателю после оплаты и клиенту-организации с
 * доступами. Только формирование — отправка идёт задачей `email.send` либо
 * прямо из воркера, поэтому модуль чистый и покрыт unit-тестами.
 *
 * У каждого письма две версии: HTML (основная) и текстовая (для клиентов без
 * HTML и как запасная в спам-фильтрах — письмо только из HTML они любят меньше).
 */

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

function base(siteUrl: string): string {
  return siteUrl.replace(/\/$/, "");
}

/**
 * Название организации в кавычках-ёлочках, но без задвоения: наименования юрлиц
 * часто уже содержат кавычки («ООО «Ромашка»»), и оборачивать их ещё раз — некрасиво.
 */
function quoted(name: string): string {
  return /[«»"]/.test(name) ? name : `«${name}»`;
}

// ─────────────────────────── Покупатель ───────────────────────────

export interface BuyerEmailInput {
  /** E-mail покупателя — он же логин. */
  email: string;
  /** Названия оплаченных курсов. */
  titles: string[];
  /** Временный пароль — только новой учётке; у существующей пароль свой. */
  tempPassword: string | null;
  siteUrl: string;
  support?: SupportLink[];
}

/**
 * Благодарность за покупку с данными для входа. Приходит сразу после оплаты, без
 * участия владельца: человек заплатил на странице банка, и это письмо — единственное,
 * что объясняет ему, куда идти дальше. Поэтому в нём есть всё: что куплено, логин и
 * пароль, что произойдёт при первом входе и как действовать, если пароль забыт.
 */
export function buyerEmail(input: BuyerEmailInput): RenderedEmail {
  const loginUrl = `${base(input.siteUrl)}/login`;
  const support = input.support ?? [];
  const many = input.titles.length > 1;
  const isNew = input.tempPassword !== null;

  const subject = many
    ? "Спасибо за покупку! Доступ к курсам открыт — ACTIVE SALES"
    : "Спасибо за покупку! Доступ к курсу открыт — ACTIVE SALES";
  const intro = many
    ? "Оплата прошла успешно, курсы уже открыты. Ниже — всё, что нужно, чтобы начать."
    : "Оплата прошла успешно, курс уже открыт. Ниже — всё, что нужно, чтобы начать.";
  const listTitle = many ? "Вы приобрели курсы:" : "Вы приобрели курс:";
  const forgot =
    "Если забудете пароль — на странице входа нажмите «Забыли пароль?»: мы пришлём ссылку для нового. Пользоваться чужими доступами и передавать свой другим нельзя: доступ личный.";
  const devices = `Заниматься можно с телефона, планшета или компьютера — прогресс сохраняется, и вы продолжите с того места, где остановились. Вход работает с ${DEVICE_LIMIT} устройств.`;

  const access = isNew
    ? [
        credentialsBox([
          { label: "Логин", value: input.email },
          { label: "Временный пароль", value: input.tempPassword! },
        ]),
        note(
          "Пароль временный: при первом входе система попросит придумать свой, и этот перестанет работать. Логин — адрес почты, на который пришло письмо.",
          "warn",
        ),
      ]
    : [
        para("Курс добавлен в вашу учётную запись — входите обычным паролем."),
        credentialsBox([{ label: "Логин", value: input.email }]),
      ];

  const bodyHtml = [
    para("Здравствуйте!"),
    para(intro),
    sectionTitle(listTitle),
    bullets(input.titles),
    sectionTitle(isNew ? "Ваши данные для входа" : "Как войти"),
    ...access,
    button("Войти в личный кабинет", loginUrl),
    sectionTitle("Как начать"),
    steps(
      isNew
        ? [
            "Нажмите кнопку выше и введите логин и временный пароль.",
            "Придумайте свой постоянный пароль.",
            "Откройте курс и начните с первого урока.",
          ]
        : ["Нажмите кнопку выше и войдите.", "Откройте курс и начните с первого урока."],
    ),
    para(devices, { muted: true, small: true }),
    para(forgot, { muted: true, small: true }),
  ].join("");

  const text = [
    "Здравствуйте!",
    "",
    "Спасибо за покупку! " + intro,
    "",
    listTitle,
    ...input.titles.map((t) => `• ${t}`),
    "",
    ...(isNew
      ? [
          "ВАШИ ДАННЫЕ ДЛЯ ВХОДА",
          `Логин: ${input.email}`,
          `Временный пароль: ${input.tempPassword}`,
          "",
          "Пароль временный: при первом входе система попросит придумать свой, и этот перестанет работать. Логин — адрес почты, на который пришло письмо.",
        ]
      : [
          "Курс добавлен в вашу учётную запись — входите обычным паролем.",
          `Логин: ${input.email}`,
        ]),
    "",
    `Вход в личный кабинет: ${loginUrl}`,
    "",
    "КАК НАЧАТЬ",
    ...(isNew
      ? [
          "1. Откройте ссылку и введите логин и временный пароль.",
          "2. Придумайте свой постоянный пароль.",
          "3. Откройте курс и начните с первого урока.",
        ]
      : ["1. Откройте ссылку и войдите.", "2. Откройте курс и начните с первого урока."]),
    "",
    devices,
    forgot,
    ...(supportText(support) ? ["", supportText(support)] : []),
    "",
    "Это автоматическое письмо, отвечать на него не нужно.",
    "ACTIVE SALES",
  ].join("\n");

  return {
    subject,
    text,
    html: shell({
      preheader: isNew
        ? "Логин и временный пароль для входа — внутри письма."
        : "Курс добавлен в вашу учётную запись.",
      heading: "Спасибо за покупку!",
      bodyHtml,
      support,
      reason: "Вы получили это письмо, потому что оплатили курс на платформе ACTIVE SALES.",
    }),
  };
}

// ─────────────────────────── Восстановление пароля ───────────────────────────

export function passwordResetEmail(input: {
  resetUrl: string;
  ttlMinutes: number;
  support?: SupportLink[];
}): RenderedEmail {
  const support = input.support ?? [];
  const ttl = `${input.ttlMinutes} ${pluralRu(input.ttlMinutes, "минуту", "минуты", "минут")}`;
  const intro =
    "Мы получили запрос на смену пароля для вашей учётной записи. Нажмите кнопку — откроется страница, где можно задать новый пароль.";
  const warning = `Ссылка действует ${ttl} и срабатывает один раз. Если вы не запрашивали смену пароля — просто проигнорируйте письмо: пароль останется прежним.`;

  return {
    subject: "Восстановление пароля — ACTIVE SALES",
    text: [
      "Здравствуйте!",
      "",
      intro,
      "",
      `Задать новый пароль: ${input.resetUrl}`,
      "",
      warning,
      ...(supportText(support) ? ["", supportText(support)] : []),
      "",
      "Это автоматическое письмо, отвечать на него не нужно.",
      "ACTIVE SALES",
    ].join("\n"),
    html: shell({
      preheader: "Ссылка для смены пароля действует один час.",
      heading: "Восстановление пароля",
      bodyHtml: [
        para("Здравствуйте!"),
        para(intro),
        button("Задать новый пароль", input.resetUrl),
        note(warning, "warn"),
        para(`Если кнопка не нажимается, скопируйте адрес в браузер: ${input.resetUrl}`, {
          muted: true,
          small: true,
        }),
      ].join(""),
      support,
      reason: "Вы получили это письмо, потому что для вашего адреса запросили восстановление пароля.",
    }),
  };
}

/** Уведомление «пароль изменён»: если менял не хозяин, он узнает об этом сразу. */
export function passwordChangedEmail(input: { support?: SupportLink[] }): RenderedEmail {
  const support = input.support ?? [];
  const body =
    "Пароль от вашей учётной записи на платформе ACTIVE SALES только что изменён. Если это сделали вы — ничего делать не нужно.";
  const alert =
    "Если это были не вы, немедленно свяжитесь с поддержкой: мы закроем доступ и поможем восстановить учётную запись.";
  return {
    subject: "Пароль изменён — ACTIVE SALES",
    text: [
      "Здравствуйте!",
      "",
      body,
      "",
      alert,
      ...(supportText(support) ? ["", supportText(support)] : []),
      "",
      "ACTIVE SALES",
    ].join("\n"),
    html: shell({
      preheader: "Пароль от вашей учётной записи изменён.",
      heading: "Пароль изменён",
      bodyHtml: [para("Здравствуйте!"), para(body), note(alert, "warn")].join(""),
      support,
      reason: "Это уведомление безопасности: оно приходит при каждой смене пароля.",
    }),
  };
}

// ─────────────────────────── Клиент-организация ───────────────────────────

export interface OrgAdminAccess {
  /** Логин ответственного — его e-mail. */
  login: string;
  /** Временный пароль; null — человек уже входил и сменил его на свой. */
  password: string | null;
}

export interface OrgLearnerAccess {
  login: string;
  password: string;
  /** Что открыто работнику: «Все курсы (12)» или список названий. */
  courses: string;
}

export interface OrgLicenseLine {
  course: string;
  seats: number;
  /** «до 19.09.2027» или «бессрочно». */
  until: string;
}

export interface OrgCredentialsEmailInput {
  orgName: string;
  siteUrl: string;
  admins: OrgAdminAccess[];
  learners: OrgLearnerAccess[];
  /** Работники, что уже вошли и сменили пароль: в письмо не попадают, но упомянуты. */
  learnersAlreadyActive: number;
  licenses: OrgLicenseLine[];
  support?: SupportLink[];
}

/** Сколько учёток печатать таблицей прямо в письме; дальше — только вложение. */
export const INLINE_LEARNERS_LIMIT = 30;

/** Кто чей: по каким текстам письма человек понимает, что делать со своей учёткой. */
const ROLE_ADMIN =
  "Ответственный — это человек компании, который управляет обучением. Через его учётку подключают сотрудников, выдают им новые пароли и смотрят, кто как учится. Проходить курсы ему необязательно.";
const ROLE_LEARNER =
  "Сотрудники — обычные учётки для обучения: человек входит и проходит курсы. Управлять обучением и смотреть чужой прогресс с такой учётки нельзя. Одна учётка — один человек.";

/**
 * Письмо клиенту-организации со всеми доступами сразу: учётка ответственного и
 * учётки сотрудников. Главная задача текста — чтобы получатель не запутался:
 * сначала объясняется, зачем нужны учётки двух видов, потом каждая идёт в своём
 * блоке под своим заголовком, потом — что делать по порядку.
 */
export function orgCredentialsEmail(input: OrgCredentialsEmailInput): RenderedEmail {
  const url = base(input.siteUrl);
  const loginUrl = `${url}/login`;
  const support = input.support ?? [];
  const learnersCount = input.learners.length;
  const inline = learnersCount > 0 && learnersCount <= INLINE_LEARNERS_LIMIT;
  const seatsWord = (n: number) => pluralRu(n, "место", "места", "мест");
  const accountsWord = (n: number) => pluralRu(n, "учётка", "учётки", "учёток");

  const subject = `Доступы к обучению ACTIVE SALES для ${quoted(input.orgName)}`;
  const intro = `Здравствуйте! Для ${quoted(input.orgName)} на платформе ACTIVE SALES подключено обучение: курсы оплачены, учётные записи созданы. В этом письме — все логины и временные пароли.`;

  // ── Ответственный ──
  const adminBlocks = input.admins.map((a) =>
    a.password
      ? para(`Адрес входа: ${loginUrl}`, { small: true }) +
        credentialsBox([
          { label: "Логин", value: a.login },
          { label: "Временный пароль", value: a.password },
        ])
      : credentialsBox([
          { label: "Логин", value: a.login },
          { label: "Пароль", value: "прежний — вы уже входили и сменили его" },
        ]),
  );
  const adminHtml = card({
    badge: "Для ответственного",
    title: "Учётка ответственного: управление обучением",
    bodyHtml: [
      para(ROLE_ADMIN),
      ...adminBlocks,
      para("Что сделать ответственному:"),
      steps([
        "Войти по ссылке и придумать свой постоянный пароль — временный после этого перестанет работать. Если пароль забудется — на странице входа есть «Забыли пароль?»: ссылка придёт на этот e-mail.",
        "В меню сверху нажать «Кабинет компании».",
        "В разделе «Работники» — видеть сотрудников и их прогресс, а если сотрудник потерял пароль, выдать ему новый: у сотрудников нет почты, поэтому сбросить его может только ответственный.",
        "В разделах «Отчёты» и «Лицензии» — следить за ходом обучения и оплаченными местами.",
      ]),
    ].join(""),
  });

  // ── Сотрудники ──
  const learnerBody: string[] = [];
  if (learnersCount === 0) {
    learnerBody.push(
      para(
        input.learnersAlreadyActive > 0
          ? "Все созданные учётки сотрудников уже использованы — новых паролей в этом письме нет."
          : "Учётки сотрудников пока не созданы.",
      ),
    );
  } else {
    learnerBody.push(
      para(ROLE_LEARNER),
      para(
        "Логины безличные: платформа не спрашивает ни ФИО, ни почту, ни телефон сотрудника. Чтобы помнить, кому какая учётка досталась, ведите собственный список.",
      ),
      inline
        ? dataTable(
            ["Логин", "Временный пароль", "Курсы"],
            input.learners.map((l) => [l.login, l.password, l.courses]),
            { monoCols: [0, 1] },
          )
        : note(
            `Учёток слишком много для таблицы в письме — полный список (${learnersCount}) во вложении, файл открывается в Excel.`,
          ),
      para("Что передать каждому сотруднику:"),
      bullets([
        `Адрес входа: ${loginUrl}`,
        "Его личный логин и временный пароль из списка выше.",
        "При первом входе придумать свой пароль: временный после этого перестанет работать.",
        `Учиться можно с телефона и компьютера, вход работает с ${DEVICE_LIMIT} устройств.`,
      ]),
    );
    if (input.learnersAlreadyActive > 0) {
      learnerBody.push(
        para(
          `Ещё ${input.learnersAlreadyActive} ${pluralRu(input.learnersAlreadyActive, "сотрудник", "сотрудника", "сотрудников")} уже вошли и сменили пароль — у них он свой, в письмо не включены.`,
          { muted: true, small: true },
        ),
      );
    }
  }
  const learnersHtml = card({
    badge: "Для сотрудников",
    title:
      learnersCount > 0
        ? `Учётки сотрудников: ${learnersCount} ${accountsWord(learnersCount)}`
        : "Учётки сотрудников",
    bodyHtml: learnerBody.join(""),
  });

  const licensesHtml =
    input.licenses.length > 0
      ? sectionTitle("Что оплачено") +
        bullets(
          input.licenses.map(
            (l) => `${l.course} — ${l.seats} ${seatsWord(l.seats)}, ${l.until}`,
          ),
        )
      : "";

  const bodyHtml = [
    para(intro),
    sectionTitle("Как устроены доступы"),
    note("В письме два вида учётных записей — для разных целей. Ниже каждая описана отдельно.", "info"),
    adminHtml,
    learnersHtml,
    licensesHtml,
    sectionTitle("Что делать дальше"),
    steps([
      "Ответственный входит и меняет пароль.",
      "Ответственный раздаёт сотрудникам их логины и пароли — по одному на человека.",
      "Сотрудники входят, меняют пароль и начинают учиться. Прогресс виден ответственному в кабинете компании.",
    ]),
    button("Открыть страницу входа", loginUrl),
    note(
      "Пароли в этом письме временные и действуют до первого входа. Письмо содержит доступы всех учёток — не пересылайте его целиком сотрудникам и удалите после раздачи.",
      "warn",
    ),
  ].join("");

  // ── текстовая версия ──
  const text = [
    intro,
    "",
    "КАК УСТРОЕНЫ ДОСТУПЫ",
    "В письме два вида учётных записей — для разных целей.",
    "",
    "1) УЧЁТКА ОТВЕТСТВЕННОГО — управление обучением",
    ROLE_ADMIN,
    ...input.admins.flatMap((a) =>
      a.password
        ? ["", `Адрес входа: ${loginUrl}`, `Логин: ${a.login}`, `Временный пароль: ${a.password}`]
        : ["", `Логин: ${a.login}`, "Пароль: прежний — вы уже входили и сменили его"],
    ),
    "",
    "Что сделать ответственному:",
    "• войти и придумать постоянный пароль (если забудется — «Забыли пароль?» на странице входа, ссылка придёт на e-mail);",
    "• в меню сверху нажать «Кабинет компании»;",
    "• в разделе «Работники» видеть сотрудников и выдавать новый пароль тому, кто свой потерял (у сотрудников нет почты, поэтому сбросить его может только ответственный);",
    "• в разделах «Отчёты» и «Лицензии» следить за ходом обучения и оплаченными местами.",
    "",
    `2) УЧЁТКИ СОТРУДНИКОВ${learnersCount > 0 ? ` — ${learnersCount} ${accountsWord(learnersCount)}` : ""}`,
    ...(learnersCount === 0
      ? [
          input.learnersAlreadyActive > 0
            ? "Все созданные учётки сотрудников уже использованы — новых паролей в этом письме нет."
            : "Учётки сотрудников пока не созданы.",
        ]
      : [
          ROLE_LEARNER,
          "Логины безличные: платформа не спрашивает ни ФИО, ни почту, ни телефон сотрудника.",
          "",
          ...(inline
            ? input.learners.map((l) => `${l.login}   ${l.password}   (${l.courses})`)
            : [`Полный список (${learnersCount}) — во вложении, файл открывается в Excel.`]),
          "",
          "Что передать каждому сотруднику: адрес входа, его логин и временный пароль; при первом входе он придумает свой пароль. " +
            `Вход работает с ${DEVICE_LIMIT} устройств.`,
          ...(input.learnersAlreadyActive > 0
            ? [
                `Ещё ${input.learnersAlreadyActive} ${pluralRu(input.learnersAlreadyActive, "сотрудник", "сотрудника", "сотрудников")} уже вошли и сменили пароль — у них он свой, в письмо не включены.`,
              ]
            : []),
        ]),
    ...(input.licenses.length > 0
      ? [
          "",
          "ЧТО ОПЛАЧЕНО",
          ...input.licenses.map((l) => `• ${l.course} — ${l.seats} ${seatsWord(l.seats)}, ${l.until}`),
        ]
      : []),
    "",
    "ЧТО ДЕЛАТЬ ДАЛЬШЕ",
    "1. Ответственный входит и меняет пароль.",
    "2. Ответственный раздаёт сотрудникам их логины и пароли — по одному на человека.",
    "3. Сотрудники входят, меняют пароль и начинают учиться. Прогресс виден ответственному в кабинете компании.",
    "",
    `Вход: ${loginUrl}`,
    "",
    "Пароли в письме временные и действуют до первого входа. Письмо содержит доступы всех учёток — не пересылайте его целиком сотрудникам и удалите после раздачи.",
    ...(supportText(support) ? ["", supportText(support)] : []),
    "",
    "Это автоматическое письмо, отвечать на него не нужно.",
    "ACTIVE SALES",
  ].join("\n");

  return {
    subject,
    text,
    html: shell({
      preheader: "Логины и временные пароли ответственного и сотрудников — с пояснением, что для чего.",
      heading: "Доступы к обучению готовы",
      bodyHtml,
      support,
      reason: `Письмо отправлено по просьбе ACTIVE SALES: ${input.orgName}.`,
    }),
  };
}

/**
 * CSV со списком учёток сотрудников для вложения. Разделитель — «;», BOM в
 * начале: русскоязычный Excel иначе открывает файл одной колонкой и в кракозябрах.
 * Последняя колонка пустая — под пометки ответственного, кому что выдано.
 */
export function learnersCsv(learners: OrgLearnerAccess[]): string {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    ["Логин", "Временный пароль", "Курсы", "Кому выдано (заполните сами)"].map(cell).join(";"),
    ...learners.map((l) => [l.login, l.password, l.courses, ""].map(cell).join(";")),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}
