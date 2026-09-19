import { db } from "@/lib/db";

/**
 * Состояние выдачи доступов клиенту-организации: что владельцу показать в
 * карточке и реестре, чтобы он не забыл отправить письмо с логинами и паролями.
 *
 * Читается из БД, а не запоминается в интерфейсе: письмо уходит фоновой задачей,
 * и успех/провал виден только по ней и по отметке в Organization.
 */

export const SEND_CREDENTIALS_JOB = "org.send-credentials";

export type DeliveryStatus =
  /** Ещё нельзя отправлять: нет лицензии, ответственного или работников. */
  | "not-ready"
  /** Учётки созданы, доступы клиенту не отправлены (или добавлены новые учётки). */
  | "unsent"
  /** Письмо в очереди или отправляется. */
  | "sending"
  /** Письмо ушло, новых неотправленных учёток нет. */
  | "sent"
  /** Последняя отправка не удалась. */
  | "failed";

export interface OrgDeliveryState {
  status: DeliveryStatus;
  /** Чего не хватает для отправки («лицензия», «ответственный», «работники»). */
  missing: string[];
  admins: number;
  learners: number;
  /** Учётки, которым ещё ни разу не выдавали пароль (passwordHash = null). */
  unissued: number;
  /** Учётки, чей владелец ещё не входил и не сменил временный пароль. */
  awaitingFirstLogin: number;
  /** Учётки, уже вошедшие и сменившие временный пароль. */
  signedIn: number;
  sentAt: Date | null;
  sentTo: string | null;
  lastError: string | null;
  /** Кого предложить получателем: ответственный, иначе контакт из реквизитов. */
  suggestedRecipient: string | null;
}

export async function getOrgDeliveryState(orgId: string): Promise<OrgDeliveryState> {
  const [org, licenses, memberships, lastJob] = await Promise.all([
    db.organization.findUnique({
      where: { id: orgId },
      select: { contactEmail: true, credentialsSentAt: true, credentialsSentTo: true },
    }),
    db.orgLicense.count({ where: { orgId } }),
    db.orgMembership.findMany({
      where: { orgId, isActive: true },
      select: {
        role: true,
        user: { select: { email: true, passwordHash: true, mustChangePassword: true } },
      },
    }),
    db.job.findFirst({
      where: { type: SEND_CREDENTIALS_JOB, payload: { path: ["orgId"], equals: orgId } },
      orderBy: { createdAt: "desc" },
      select: { status: true, lastError: true, finishedAt: true },
    }),
  ]);

  const adminRows = memberships.filter((m) => m.role === "ORG_ADMIN");
  const admins = adminRows.length;
  const learners = memberships.filter((m) => m.role === "ORG_LEARNER").length;
  const unissued = memberships.filter((m) => !m.user.passwordHash).length;
  const awaitingFirstLogin = memberships.filter((m) => m.user.mustChangePassword).length;
  const signedIn = memberships.length - awaitingFirstLogin;

  const missing: string[] = [];
  if (licenses === 0) missing.push("лицензия");
  if (admins === 0) missing.push("ответственный");
  if (learners === 0) missing.push("работники");

  const sentAt = org?.credentialsSentAt ?? null;
  const jobFailedAfterSend =
    lastJob?.status === "FAILED" && (!sentAt || (lastJob.finishedAt && lastJob.finishedAt > sentAt));

  let status: DeliveryStatus;
  if (lastJob && (lastJob.status === "QUEUED" || lastJob.status === "RUNNING")) status = "sending";
  else if (missing.length > 0) status = "not-ready";
  else if (jobFailedAfterSend) status = "failed";
  // Клиент, в котором кто-то уже входил, получил доступы (раньше — вручную, до
  // появления письма): вечно светить ему «не отправлено» значило бы шуметь зря.
  else if (unissued > 0 || (!sentAt && signedIn === 0)) status = "unsent";
  else status = "sent";

  return {
    status,
    missing,
    admins,
    learners,
    unissued,
    awaitingFirstLogin,
    signedIn,
    sentAt,
    sentTo: org?.credentialsSentTo ?? null,
    lastError: status === "failed" ? (lastJob?.lastError ?? null) : null,
    suggestedRecipient:
      adminRows.find((a) => a.user.email)?.user.email ?? org?.contactEmail ?? null,
  };
}

/** Организации, которым доступы ещё не отправлены, — для пометки в реестре. */
export async function getOrgIdsAwaitingDelivery(): Promise<Set<string>> {
  const rows = await db.orgMembership.findMany({
    where: {
      isActive: true,
      org: { status: "ACTIVE", licenses: { some: {} } },
      OR: [
        { user: { passwordHash: null } },
        // Письма не было, и никто из клиента ещё не входил.
        {
          org: {
            credentialsSentAt: null,
            memberships: { none: { isActive: true, user: { mustChangePassword: false } } },
          },
        },
      ],
    },
    select: { orgId: true },
    distinct: ["orgId"],
  });
  return new Set(rows.map((r) => r.orgId));
}
