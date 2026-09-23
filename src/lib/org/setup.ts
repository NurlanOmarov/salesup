import { db } from "@/lib/db";

/**
 * Состояние подготовки корпоративного клиента и шаги, которые из него следуют.
 *
 * Запуск клиента — это цепочка из нескольких действий в разных местах: лицензия
 * и ответственный заводятся владельцем в /admin/orgs/<id>, работники —
 * в кабинете клиента /org/<id>/employees. Делать это может кто угодно из двоих:
 * владелец умеет всё (он допущен в кабинет клиента как OWNER), ответственный —
 * всё, кроме лицензий. Поэтому состояние читается из БД и одинаково для обеих
 * ролей: шаг, выполненный одним, у второго сразу отмечен сделанным.
 *
 * Тексты шагов — не украшение, а замена инструкции: человек не должен помнить
 * порядок и искать нужный раздел.
 */

export interface OrgSetupState {
  /** Лицензий выдано (курс × места). Без них работникам нечего открывать. */
  licenses: number;
  seatsTotal: number;
  /** Назначено ответственных представителей (активных). */
  admins: number;
  /** Хотя бы один ответственный уже входил и сменил временный пароль. */
  adminSignedIn: boolean;
  /** Работников в организации (активных). */
  learners: number;
  /** Сколько работников уже вошли и сменили временный пароль. */
  learnersSignedIn: number;
  /** Подписан ли хоть один работник (необязательный шаг). */
  namesConfigured: boolean;
}

export async function getOrgSetupState(orgId: string): Promise<OrgSetupState> {
  const [licenses, admins, adminsSignedIn, learners, learnersSignedIn, labelled] =
    await Promise.all([
      db.orgLicense.aggregate({
        where: { orgId },
        _count: true,
        _sum: { seatsTotal: true },
      }),
      db.orgMembership.count({ where: { orgId, role: "ORG_ADMIN", isActive: true } }),
      db.orgMembership.count({
        where: {
          orgId,
          role: "ORG_ADMIN",
          isActive: true,
          user: { mustChangePassword: false },
        },
      }),
      db.orgMembership.count({ where: { orgId, role: "ORG_LEARNER", isActive: true } }),
      db.orgMembership.count({
        where: {
          orgId,
          role: "ORG_LEARNER",
          isActive: true,
          user: { mustChangePassword: false },
        },
      }),
      db.orgMembership.count({ where: { orgId, label: { not: null } } }),
    ]);

  return {
    licenses: licenses._count,
    seatsTotal: licenses._sum.seatsTotal ?? 0,
    admins,
    adminSignedIn: adminsSignedIn > 0,
    learners,
    learnersSignedIn,
    namesConfigured: labelled > 0,
  };
}

export interface SetupStep {
  key: string;
  title: string;
  body: string;
  done: boolean;
  /** Куда вести за выполнением шага. Якорь (#licenses) или адрес страницы. */
  href?: string;
  linkLabel?: string;
  /** Необязательный шаг: не мешает считать настройку завершённой. */
  optional?: boolean;
}

/**
 * Порядок запуска глазами владельца: от «нечего продавать» до «люди учатся».
 * Последний шаг нарочно не требует идти к клиенту — если тот не спешит,
 * владелец заводит работников за него в его же кабинете.
 */
export function ownerSetupSteps(
  state: OrgSetupState,
  orgId: string,
  details: {
    hasRequisites: boolean;
    /** Письмо с доступами клиенту отправлено (или клиент уже вошёл сам). */
    credentialsDelivered?: boolean;
    /** Клиент отмечен платным — тогда в шагах появляется запись оплаты. */
    billingPaid?: boolean;
    /** По клиенту есть хотя бы одно поступление (lib/finance). */
    hasIncome?: boolean;
  },
): SetupStep[] {
  const steps: SetupStep[] = [
    {
      key: "requisites",
      title: "Заполнить реквизиты клиента",
      body: "УНП и e-mail ответственного нужны для счёта и для письма с доступами: если e-mail указан, ответственный заведётся сам при выдаче лицензии.",
      done: details.hasRequisites,
      href: "#requisites",
      linkLabel: "К реквизитам",
      optional: true,
    },
    {
      key: "license",
      title: "Выдать лицензию",
      body: "Курс и количество мест. На каждое место платформа сама создаст кабинет работника — заводить их руками не нужно. Место — это «курс × человек»: работнику с тремя курсами нужно по месту в каждой из трёх лицензий, а учётка у него одна.",
      done: state.licenses > 0,
      href: "#licenses",
      linkLabel: "Выдать лицензию",
    },
    {
      key: "admin",
      title: "Назначить ответственного",
      body: "Человек со стороны клиента, который будет подключать сотрудников и смотреть отчёты. Достаточно e-mail. Если e-mail указан в реквизитах, при выдаче лицензии ответственный создаётся сам — этот шаг закроется без вас.",
      done: state.admins > 0,
      href: "#admins",
      linkLabel: "Назначить",
    },
    {
      key: "members",
      title: "Кабинеты работников",
      body: "Создаются автоматически при выдаче лицензии — по одному на место. Дозаводить сотрудников сверх мест не нужно; если клиенту нужно больше, увеличьте число мест в лицензии.",
      done: state.learners > 0,
      href: `/org/${orgId}/employees`,
      linkLabel: "Посмотреть работников",
    },
    {
      key: "handover",
      title: "Отправить клиенту доступы",
      body: "Блок «Доступы клиенту» вверху страницы: одна кнопка отправляет письмо со всеми логинами и паролями — и ответственного, и сотрудников — с объяснением, для чего какая учётка. Шаг закроется, когда письмо уйдёт или ответственный войдёт и сменит временный пароль.",
      done: Boolean(details.credentialsDelivered) || state.adminSignedIn,
      href: "#delivery",
      linkLabel: "К отправке",
    },
    {
      key: "learners",
      title: "Дождаться первых входов",
      body: "Шаг закроется, когда сотрудник войдёт по выданному логину и сменит временный пароль. В списке он остаётся под условным обозначением — ФИО платформа не получает.",
      done: state.learnersSignedIn > 0,
    },
  ];

  // Оплату показываем только платным клиентам: у пилота денег нет по условию,
  // и вечно незакрытый шаг в его чеклисте был бы просто шумом. Вставляем сразу
  // за лицензией — именно за неё клиент и платит.
  if (details.billingPaid) {
    const afterLicense = steps.findIndex((s) => s.key === "license") + 1;
    steps.splice(afterLicense, 0, {
      key: "income",
      title: "Записать оплату",
      body: "Клиент отмечен платным — внесите поступление, иначе этих денег нет ни в доходах, ни в гонорарах, ни в дайджесте. Форма открывается заполненной по лицензии: останется сверить сумму, дату и валюту с тем, что реально пришло.",
      done: Boolean(details.hasIncome),
      href: `/admin/finance?org=${orgId}#new`,
      linkLabel: "Заполнить оплату",
    });
  }

  return steps;
}

/**
 * Те же данные глазами ответственного. Смену временного пароля в шаги не
 * включаем: до кабинета он с временным паролем просто не дойдёт — guard уводит
 * на /change-password.
 */
export function orgAdminSetupSteps(state: OrgSetupState, orgId: string): SetupStep[] {
  const base = `/org/${orgId}`;
  return [
    {
      key: "license",
      title: "Проверьте оплаченные места",
      body:
        state.licenses > 0
          ? `Оплачено мест: ${state.seatsTotal}. Место — это один курс для одного человека: сотруднику с двумя курсами нужно два места.`
          : "Курсы для вашей команды ещё не подключены — напишите нам, и мы добавим их.",
      done: state.licenses > 0,
      // Пока курсов нет, вести на пустую вкладку незачем — идти человеку некуда.
      href: state.licenses > 0 ? `${base}/licenses` : undefined,
      linkLabel: "Посмотреть лицензии",
    },
    {
      key: "members",
      title: "Заведите работников",
      body: "Укажите, сколько человек подключаете и какие курсы им открыть. Платформа выдаст логины вида org-0001 и временные пароли — по одному на сотрудника. При желании тут же подпишите учётки, чтобы не перепутать, кому какой логин достался.",
      done: state.learners > 0,
      href: `${base}/employees`,
      linkLabel: "Завести работников",
    },
    {
      key: "handout",
      title: "Раздайте логины и пароли",
      body: "После создания появится готовое сообщение для каждого сотрудника — вставьте его в чат или письмо. Пароли показываются один раз; потерянный сбрасывается в строке работника. Шаг закроется, когда кто-то войдёт и сменит временный пароль.",
      done: state.learnersSignedIn > 0,
      href: `${base}/employees`,
      linkLabel: "К работникам",
    },
    {
      key: "names",
      title: "Подпишите работников",
      body: "По желанию. Платформа знает сотрудников только по логинам вида org-0001. Чтобы не путать, кто есть кто, подпишите их как вам удобно — кличкой, должностью, «Кассир-2». ФИО не вписывайте.",
      done: state.namesConfigured,
      href: `${base}/employees`,
      linkLabel: "К работникам",
      optional: true,
    },
  ];
}

/**
 * Короткая подсказка «что с этим клиентом делать дальше» для реестра
 * организаций. Считается по данным, которые в списке уже есть, — лишних
 * запросов на строку не делает; подробный чеклист живёт в карточке клиента.
 */
export function nextOrgStepHint(row: {
  licenses: number;
  admins: number;
  members: number;
}): string | null {
  if (row.licenses === 0) return "выдать лицензию";
  if (row.admins === 0) return "назначить ответственного";
  if (row.members === 0) return "завести работников";
  return null;
}
