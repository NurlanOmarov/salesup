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
  /** Настроен ли ПИН-код имён работников (необязательный шаг). */
  namesConfigured: boolean;
}

export async function getOrgSetupState(orgId: string): Promise<OrgSetupState> {
  const [licenses, admins, adminsSignedIn, learners, learnersSignedIn, keyWraps] =
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
      db.orgKeyWrap.count({ where: { orgId } }),
    ]);

  return {
    licenses: licenses._count,
    seatsTotal: licenses._sum.seatsTotal ?? 0,
    admins,
    adminSignedIn: adminsSignedIn > 0,
    learners,
    learnersSignedIn,
    namesConfigured: keyWraps > 0,
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
  details: { hasRequisites: boolean },
): SetupStep[] {
  return [
    {
      key: "requisites",
      title: "Заполнить реквизиты клиента",
      body: "УНП и контакт ответственного нужны для счёта и для связи. На работу платформы не влияют.",
      done: details.hasRequisites,
      href: "#requisites",
      linkLabel: "К реквизитам",
      optional: true,
    },
    {
      key: "license",
      title: "Выдать лицензию",
      body: "Курс и количество мест. Место — это «курс × человек»: работнику с тремя курсами нужно по месту в каждой из трёх лицензий. Пока лицензии нет, работникам нечего открывать.",
      done: state.licenses > 0,
      href: "#licenses",
      linkLabel: "Выдать лицензию",
    },
    {
      key: "admin",
      title: "Назначить ответственного",
      body: "Человек со стороны клиента, который будет заводить сотрудников и смотреть отчёты. Достаточно e-mail — система создаст учётку и покажет временный пароль.",
      done: state.admins > 0,
      href: "#admins",
      linkLabel: "Назначить",
    },
    {
      key: "handover",
      title: "Передать доступ ответственному",
      body: "После создания учётки появится готовое сообщение с логином, паролем и объяснением, что делать дальше, — скопируйте и отправьте клиенту. Шаг закроется, когда он войдёт и сменит временный пароль. Пароль показывается один раз: если он потерян, сбросьте его в списке ответственных — сообщение появится снова.",
      done: state.adminSignedIn,
      href: "#admins",
      linkLabel: "К ответственным",
    },
    {
      key: "members",
      title: "Завести работников",
      body: "Обычно это делает ответственный в своём кабинете. Если клиент не спешит, сделайте за него: откройте кабинет клиента, вкладка «Работники» — платформа выдаст логины и временные пароли, там же копируется готовое сообщение для сотрудника.",
      done: state.learners > 0,
      href: `/org/${orgId}/employees`,
      linkLabel: "Открыть работников",
    },
    {
      key: "learners",
      title: "Дождаться первых входов",
      body: "Шаг закроется, когда сотрудник войдёт по выданному логину и сменит временный пароль. В списке он остаётся под условным обозначением — ФИО платформа не получает.",
      done: state.learnersSignedIn > 0,
    },
  ];
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
      body: "Укажите, сколько человек подключаете и какие курсы им открыть. Платформа выдаст логины вида org-0001 и временные пароли — по одному на сотрудника. При желании тут же подпишите учётки именами, чтобы не перепутать, кому какой логин достался.",
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
      title: "Подпишите работников именами",
      body: "По желанию. Платформа знает сотрудников только по логинам вида org-0001. Вы можете присвоить им имена: они шифруются в вашем браузере ПИН-кодом, которого у нас нет.",
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
