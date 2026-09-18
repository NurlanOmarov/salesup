"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/safe-action";
import { db } from "@/lib/db";
import { writeAdminLog } from "@/lib/admin/log";
import { assertOrgScope, assertOrgWritable, requireOrgAdmin } from "@/lib/org/guards";
import {
  createMembers,
  grantSeat,
  recalcLoginSeq,
  revokeSeat,
} from "@/lib/org/service";
import { hashPassword } from "@/lib/auth/password";
import { generateTempPassword } from "@/lib/auth/temp-password";
import { enqueue } from "@/lib/jobs/enqueue";

/**
 * Действия ответственного представителя в кабинете организации.
 *
 * Два инварианта, которые здесь нельзя нарушать:
 *  1. Организация берётся из СЕССИИ (requireOrgAdmin), а не из параметров формы.
 *     Всё, что пришло с клиента (id работника, лицензии, кода), проверяется через
 *     assertOrgScope — иначе это дыра IDOR в чужую организацию.
 *  2. Никаких персональных данных работников: поля name/email/phone здесь не
 *     принимаются вовсе (оферта /offer-b2b, п. 10.1), метка приходит уже
 *     зашифрованной браузером и сервером не читается.
 */

/** Организация из сессии + запрет записи для приостановленных. */
async function writableCtx(orgId?: string) {
  const ctx = await requireOrgAdmin(orgId);
  assertOrgWritable(ctx);
  return ctx;
}

/**
 * Подписи и подразделения работников ведёт ответственный клиента, не владелец
 * платформы: что вписать напротив логина, решает клиент (оферта /offer-b2b,
 * п. 10.1 — без ФИО). Проверка стоит на сервере, а не только в UI: auth
 * «orgAdmin» пропускает и OWNER.
 */
function assertNotOwnerView(ctx: { isOwner: boolean }): void {
  if (ctx.isOwner) {
    throw new Error(
      "Подписи работников ведёт ответственный представитель клиента — владельцу платформы они недоступны.",
    );
  }
}

/**
 * Подпись работника: любой короткий текст, который ответственному удобен —
 * имя, кличка, должность. Пробелы по краям срезаем, пустое — это «без подписи».
 */
const labelSchema = z
  .string()
  .trim()
  .max(60, "Подпись — не длиннее 60 знаков")
  .nullable()
  .transform((v) => (v ? v : null));

/**
 * Создать работников пачкой: логины и временные пароли генерирует платформа.
 * Персональные данные по-прежнему не принимаются — ни одного поля для них в
 * схеме нет, и появиться оно не должно (оферта /offer-b2b, п. 10.1).
 */
export const createMembersAction = safeAction(
  {
    schema: z.object({
      orgId: z.string().optional(),
      count: z.coerce.number().int().min(1).max(100),
      licenseIds: z.array(z.string()).min(1, "Выберите хотя бы один курс"),
      groupId: z.string().optional(),
      // Подписи работников — произвольный текст ответственного (кличка,
      // должность, «Кассир-2»), по одной на создаваемого. Отдельных полей
      // name/email/phone в B2B-действиях нет и быть не должно (CLAUDE.md, правило 9).
      labels: z.array(labelSchema).max(100).optional(),
    }),
    auth: "orgAdmin",
  },
  async (input) => {
    const ctx = await writableCtx(input.orgId);

    // Подписи и число работников считаются по одному индексу — рассинхрон
    // означал бы подпись, приклеенную к чужому логину.
    if (input.labels && input.labels.length !== input.count) {
      throw new Error("Подписи не совпали с числом работников — обновите страницу");
    }
    if (input.labels?.some((l) => l !== null)) assertNotOwnerView(ctx);

    const licenses = await db.orgLicense.findMany({
      where: { id: { in: input.licenseIds } },
      select: { id: true, orgId: true },
    });
    if (licenses.length !== input.licenseIds.length) {
      throw new Error("Лицензия не найдена");
    }
    for (const l of licenses) assertOrgScope(l, ctx);

    if (input.groupId) {
      const group = await db.orgGroup.findUnique({
        where: { id: input.groupId },
        select: { orgId: true },
      });
      assertOrgScope(group, ctx);
    }

    const members = await createMembers({
      orgId: ctx.orgId,
      count: input.count,
      licenseIds: input.licenseIds,
      groupId: input.groupId ?? null,
      labels: input.labels,
    });

    await writeAdminLog({
      actorId: ctx.userId,
      action: "org.member.create",
      meta: {
        orgId: ctx.orgId,
        count: members.length,
        licenseIds: input.licenseIds,
      },
    });

    revalidatePath(`/org/${ctx.orgId}/employees`);
    return { members };
  },
);

// ─────────────────────────── Места ───────────────────────────

export const grantSeatAction = safeAction(
  {
    schema: z.object({
      orgId: z.string().optional(),
      membershipId: z.string().min(1),
      licenseId: z.string().min(1),
    }),
    auth: "orgAdmin",
  },
  async (input) => {
    const ctx = await writableCtx(input.orgId);

    const membership = await db.orgMembership.findUnique({
      where: { id: input.membershipId },
      select: { orgId: true, userId: true },
    });
    assertOrgScope(membership, ctx);

    const license = await db.orgLicense.findUnique({
      where: { id: input.licenseId },
      select: { orgId: true },
    });
    assertOrgScope(license, ctx);

    const { enrollmentId } = await grantSeat({
      orgId: ctx.orgId,
      userId: membership.userId,
      licenseId: input.licenseId,
    });

    await writeAdminLog({
      actorId: ctx.userId,
      action: "org.seat.grant",
      targetUserId: membership.userId,
      meta: { orgId: ctx.orgId, licenseId: input.licenseId, enrollmentId },
    });

    revalidatePath("/org/employees");
    return { enrollmentId };
  },
);

export const revokeSeatAction = safeAction(
  {
    schema: z.object({ orgId: z.string().optional(), enrollmentId: z.string().min(1) }),
    auth: "orgAdmin",
  },
  async (input) => {
    const ctx = await writableCtx(input.orgId);
    await revokeSeat({ orgId: ctx.orgId, enrollmentId: input.enrollmentId });

    await writeAdminLog({
      actorId: ctx.userId,
      action: "org.seat.revoke",
      meta: { orgId: ctx.orgId, enrollmentId: input.enrollmentId },
    });

    revalidatePath("/org/employees");
    return { ok: true };
  },
);

// ─────────────────────────── Работники ───────────────────────────

/** Сохранить подпись работника. Пустая строка стирает подпись. */
export const setMemberLabelAction = safeAction(
  {
    schema: z.object({
      orgId: z.string().optional(),
      membershipId: z.string().min(1),
      label: labelSchema,
    }),
    auth: "orgAdmin",
  },
  async (input) => {
    const ctx = await writableCtx(input.orgId);
    assertNotOwnerView(ctx);
    const membership = await db.orgMembership.findUnique({
      where: { id: input.membershipId },
      select: { orgId: true },
    });
    assertOrgScope(membership, ctx);

    await db.orgMembership.update({
      where: { id: input.membershipId },
      data: { label: input.label },
    });

    revalidatePath("/org/employees");
    return { ok: true };
  },
);

/** Отключить/включить работника: места освобождаются и возвращаются джобом. */
export const setMemberActiveAction = safeAction(
  {
    schema: z.object({
      orgId: z.string().optional(),
      membershipId: z.string().min(1),
      isActive: z.boolean(),
    }),
    auth: "orgAdmin",
  },
  async (input) => {
    const ctx = await writableCtx(input.orgId);
    const membership = await db.orgMembership.findUnique({
      where: { id: input.membershipId },
      select: { orgId: true, userId: true },
    });
    assertOrgScope(membership, ctx);

    await db.orgMembership.update({
      where: { id: input.membershipId },
      data: {
        isActive: input.isActive,
        deactivatedAt: input.isActive ? null : new Date(),
      },
    });

    await enqueue("org.sync-access", { orgId: ctx.orgId });

    await writeAdminLog({
      actorId: ctx.userId,
      action: input.isActive ? "org.member.activate" : "org.member.deactivate",
      targetUserId: membership.userId,
      meta: { orgId: ctx.orgId },
    });

    revalidatePath("/org/employees");
    return { ok: true };
  },
);

/**
 * Удалить работника из организации.
 *
 * Нужно ровно для одного случая — ошибочно заведённой или лишней учётки: код
 * создан, человек уволился или не пришёл, и держать его в списке незачем.
 * Обычный уход сотрудника закрывается «Отключить»: место возвращается в пул,
 * а прогресс остаётся в отчётности.
 *
 * Учётку с выданным сертификатом или оплаченным заказом физически не удаляем —
 * за ней стоит документ, проверяемый по /verify, или платёжная история. Такая
 * помечается удалённой (deletedAt): вход закрыт, место освобождено, сертификат
 * продолжает проверяться.
 */
export const deleteMemberAction = safeAction(
  {
    schema: z.object({
      orgId: z.string().optional(),
      membershipId: z.string().min(1),
    }),
    auth: "orgAdmin",
  },
  async (input) => {
    const ctx = await writableCtx(input.orgId);
    const membership = await db.orgMembership.findUnique({
      where: { id: input.membershipId },
      select: {
        orgId: true,
        userId: true,
        role: true,
        user: { select: { login: true } },
        org: { select: { slug: true } },
      },
    });
    assertOrgScope(membership, ctx);
    if (membership.role !== "ORG_LEARNER") {
      throw new Error("Удалять можно только работников, не ответственных представителей");
    }

    const [certificates, orders] = await Promise.all([
      db.certificate.count({ where: { userId: membership.userId } }),
      db.order.count({ where: { userId: membership.userId } }),
    ]);
    const keep = certificates > 0 || orders > 0;

    await db.$transaction(async (tx) => {
      await tx.enrollment.deleteMany({ where: { userId: membership.userId } });
      await tx.orgMembership.delete({ where: { id: input.membershipId } });
      if (keep) {
        await tx.user.update({
          where: { id: membership.userId },
          data: { deletedAt: new Date() },
        });
      } else {
        await tx.user.delete({ where: { id: membership.userId } });
      }
      // Счётчик логинов идёт следом за учётками: иначе после удаления
      // единственного acme-0001 следующий работник стал бы acme-0002.
      await recalcLoginSeq(tx, ctx.orgId, membership.org.slug);
    });

    await writeAdminLog({
      actorId: ctx.userId,
      action: "org.member.delete",
      // targetUserId не пишем: учётки чаще всего уже не существует. Логин в
      // meta — не ПДн, это условное обозначение вида acme-0042.
      meta: { orgId: ctx.orgId, login: membership.user.login, kept: keep },
    });

    revalidatePath(`/org/${ctx.orgId}/employees`);
    return { kept: keep };
  },
);

/**
 * Сбросить пароль работнику. Ответственный представитель делает это сам —
 * у работника нет e-mail, и восстановить пароль письмом невозможно by design.
 */
export const resetMemberPasswordAction = safeAction(
  {
    schema: z.object({ orgId: z.string().optional(), membershipId: z.string().min(1) }),
    auth: "orgAdmin",
  },
  async (input) => {
    const ctx = await writableCtx(input.orgId);
    const membership = await db.orgMembership.findUnique({
      where: { id: input.membershipId },
      select: { orgId: true, userId: true, user: { select: { login: true } } },
    });
    assertOrgScope(membership, ctx);

    const tempPassword = generateTempPassword();
    await db.user.update({
      where: { id: membership.userId },
      data: {
        passwordHash: await hashPassword(tempPassword),
        mustChangePassword: true,
      },
    });

    await writeAdminLog({
      actorId: ctx.userId,
      action: "org.member.password_reset",
      targetUserId: membership.userId,
      meta: { orgId: ctx.orgId },
    });

    return { login: membership.user.login ?? "", tempPassword };
  },
);

// ─────────────────────────── Подразделения ───────────────────────────

export const createGroupAction = safeAction(
  {
    schema: z.object({
      orgId: z.string().optional(),
      name: z.string().trim().min(1, "Введите название").max(60),
    }),
    auth: "orgAdmin",
  },
  async (input) => {
    const ctx = await writableCtx(input.orgId);
    const group = await db.orgGroup.create({
      data: { orgId: ctx.orgId, name: input.name },
      select: { id: true },
    });

    await writeAdminLog({
      actorId: ctx.userId,
      action: "org.group.create",
      meta: { orgId: ctx.orgId, groupId: group.id },
    });

    revalidatePath("/org/settings");
    return { groupId: group.id };
  },
);

export const setMemberGroupAction = safeAction(
  {
    schema: z.object({
      orgId: z.string().optional(),
      membershipId: z.string().min(1),
      groupId: z.string().nullable(),
    }),
    auth: "orgAdmin",
  },
  async (input) => {
    const ctx = await writableCtx(input.orgId);
    assertNotOwnerView(ctx);
    const membership = await db.orgMembership.findUnique({
      where: { id: input.membershipId },
      select: { orgId: true },
    });
    assertOrgScope(membership, ctx);

    if (input.groupId) {
      const group = await db.orgGroup.findUnique({
        where: { id: input.groupId },
        select: { orgId: true },
      });
      assertOrgScope(group, ctx);
    }

    await db.orgMembership.update({
      where: { id: input.membershipId },
      data: { groupId: input.groupId },
    });

    revalidatePath("/org/employees");
    return { ok: true };
  },
);
