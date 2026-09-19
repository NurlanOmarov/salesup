import { db } from "@/lib/db";
import { env } from "@/env";
import { log } from "@/lib/log";
import { hashPassword } from "@/lib/auth/password";
import { generateTempPassword } from "@/lib/auth/temp-password";
import { writeAdminLog } from "@/lib/admin/log";
import { enqueue } from "@/lib/jobs/enqueue";
import { escapeHtml } from "@/lib/notify/escape";
import { pluralRu } from "@/lib/courses/plural";
import { sendEmail } from "@/lib/email/send";
import { emailSupportLinks } from "@/lib/email/support";
import {
  learnersCsv,
  orgCredentialsEmail,
  type OrgLearnerAccess,
  type OrgLicenseLine,
} from "@/lib/email/templates";
import { siteOriginByCode } from "@/lib/seo/site-hosts";

/**
 * Отправка клиенту-организации письма со всеми доступами: учётка ответственного
 * и учётки работников. Выполняется ТОЛЬКО в воркере (нужен SMTP), по задаче
 * `org.send-credentials`, которую ставит владелец кнопкой в карточке организации.
 *
 * Пароли нигде не хранятся: временный пароль генерируется здесь, уходит в письмо,
 * а в базу ложится только его argon2id-хеш. Поэтому «отправить» = «выдать новые
 * временные пароли всем, кто ещё не входил» — у работников, уже сменивших пароль
 * на свой, ничего не трогаем.
 *
 * Порядок: подготовить пароли → отправить письмо → записать хеши. Если SMTP
 * недоступен, в базе ничего не меняется, а ранее выданные пароли остаются рабочими.
 */

export interface SendCredentialsResult {
  admins: number;
  learners: number;
  alreadyActive: number;
}

const HASH_BATCH = 16;
const WRITE_BATCH = 100;

async function hashAll(passwords: string[]): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < passwords.length; i += HASH_BATCH) {
    out.push(...(await Promise.all(passwords.slice(i, i + HASH_BATCH).map(hashPassword))));
  }
  return out;
}

export async function sendOrgCredentials(input: {
  orgId: string;
  to: string;
  actorId: string;
}): Promise<SendCredentialsResult> {
  if (!env.EMAIL_ENABLED) {
    throw new Error("Почта выключена (EMAIL_ENABLED=false) — письмо отправить нельзя");
  }

  const org = await db.organization.findUnique({
    where: { id: input.orgId },
    select: { id: true, name: true, site: true },
  });
  if (!org) throw new Error("Организация не найдена");

  const [licenses, memberships] = await Promise.all([
    db.orgLicense.findMany({
      where: { orgId: org.id },
      orderBy: { course: { sortOrder: "asc" } },
      select: {
        id: true,
        courseId: true,
        seatsTotal: true,
        expiresAt: true,
        course: { select: { title: true } },
      },
    }),
    db.orgMembership.findMany({
      where: { orgId: org.id, isActive: true },
      orderBy: { joinedAt: "asc" },
      select: {
        role: true,
        user: {
          select: {
            id: true,
            login: true,
            email: true,
            mustChangePassword: true,
            enrollments: {
              where: { revokedAt: null, licenseId: { not: null } },
              select: { courseId: true },
            },
          },
        },
      },
    }),
  ]);

  const adminRows = memberships.filter((m) => m.role === "ORG_ADMIN");
  if (adminRows.length === 0) throw new Error("Не назначен ответственный представитель");
  if (licenses.length === 0) throw new Error("Не выдана лицензия");

  const learnerRows = memberships.filter((m) => m.role === "ORG_LEARNER");
  const pendingAdmins = adminRows.filter((m) => m.user.mustChangePassword);
  const pendingLearners = learnerRows.filter((m) => m.user.mustChangePassword);
  const alreadyActive = learnerRows.length - pendingLearners.length;

  if (pendingAdmins.length === 0 && pendingLearners.length === 0) {
    throw new Error("Все учётки уже использованы — новых паролей выдавать не нужно");
  }

  // Пароли и хеши для всех, кому нужны новые.
  const pending = [...pendingAdmins, ...pendingLearners];
  const passwords = pending.map(() => generateTempPassword());
  const hashes = await hashAll(passwords);
  const passwordOf = new Map(pending.map((m, i) => [m.user.id, passwords[i]!]));

  const titleByCourse = new Map(licenses.map((l) => [l.courseId, l.course.title]));
  const coursesLabel = (courseIds: string[]): string => {
    const known = courseIds.filter((id) => titleByCourse.has(id));
    if (licenses.length > 1 && known.length === licenses.length) return `Все курсы (${known.length})`;
    if (known.length <= 3) return known.map((id) => titleByCourse.get(id)).join("; ") || "—";
    return `${known.length} ${pluralRu(known.length, "курс", "курса", "курсов")} из ${licenses.length}`;
  };

  const learners: OrgLearnerAccess[] = pendingLearners.map((m) => ({
    login: m.user.login ?? "",
    password: passwordOf.get(m.user.id)!,
    courses: coursesLabel(m.user.enrollments.map((e) => e.courseId)),
  }));
  const licenseLines: OrgLicenseLine[] = licenses.map((l) => ({
    course: l.course.title,
    seats: l.seatsTotal,
    until: l.expiresAt ? `до ${l.expiresAt.toLocaleDateString("ru-RU")}` : "бессрочно",
  }));

  const mail = orgCredentialsEmail({
    orgName: org.name,
    siteUrl: siteOriginByCode(org.site),
    admins: adminRows.map((m) => ({
      login: m.user.email ?? m.user.login ?? "",
      password: passwordOf.get(m.user.id) ?? null,
    })),
    learners,
    learnersAlreadyActive: alreadyActive,
    licenses: licenseLines,
    support: emailSupportLinks(org.site),
  });

  await sendEmail({
    to: input.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    attachments:
      learners.length > 0
        ? [
            {
              filename: "logins.csv",
              content: learnersCsv(learners),
              contentType: "text/csv; charset=utf-8",
            },
          ]
        : undefined,
  });

  // Письмо ушло — фиксируем пароли, которые в нём указаны.
  for (let i = 0; i < pending.length; i += WRITE_BATCH) {
    const slice = pending.slice(i, i + WRITE_BATCH);
    await db.$transaction(
      slice.map((m, j) =>
        db.user.update({
          where: { id: m.user.id },
          data: { passwordHash: hashes[i + j]!, mustChangePassword: true },
        }),
      ),
    );
  }

  await db.organization.update({
    where: { id: org.id },
    data: { credentialsSentAt: new Date(), credentialsSentTo: input.to },
  });
  await writeAdminLog({
    actorId: input.actorId,
    action: "org.credentials.send",
    meta: { orgId: org.id, admins: pendingAdmins.length, learners: learners.length, alreadyActive },
  });
  await enqueue("telegram.send", {
    text:
      `✅ <b>Доступы отправлены клиенту</b>\n` +
      `Организация: ${escapeHtml(org.name)}\n` +
      `Ответственных: ${pendingAdmins.length}, сотрудников: ${learners.length}\n` +
      `Письмо ушло на ${escapeHtml(input.to)}.`,
  });

  log.info(
    { orgId: org.id, admins: pendingAdmins.length, learners: learners.length },
    "org.send-credentials: письмо с доступами отправлено",
  );
  return { admins: pendingAdmins.length, learners: learners.length, alreadyActive };
}

/** Сообщить владельцу, что отправка сорвалась: иначе он узнает только из карточки. */
export async function notifyCredentialsFailed(orgId: string, reason: string): Promise<void> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { name: true } });
  await enqueue("telegram.send", {
    text:
      `❌ <b>Доступы клиенту не отправлены</b>\n` +
      `Организация: ${escapeHtml(org?.name ?? orgId)}\n` +
      `Причина: ${escapeHtml(reason)}\n` +
      `Откройте карточку организации и нажмите «Отправить» ещё раз.`,
  });
}
