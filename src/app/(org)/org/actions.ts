"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/safe-action";
import { db } from "@/lib/db";
import { writeAdminLog } from "@/lib/admin/log";
import { assertOrgScope, assertOrgWritable, requireOrgAdmin } from "@/lib/org/guards";
import {
  createInvite,
  createMembers,
  getInviteReservations,
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
 * Действия вокруг имён закрыты для владельца платформы. Он ведёт клиента
 * (лицензии, коды, отчёты), но кто стоит за кодом — знать не должен: способность
 * платформы прочитать имя сделала бы её оператором персональных данных
 * работников, чего оферта /offer-b2b (п. 10) прямо не предполагает. Проверка
 * стоит на сервере, а не только в UI: auth «orgAdmin» пропускает и OWNER.
 */
function assertNotOwnerView(ctx: { isOwner: boolean }): void {
  if (ctx.isOwner) {
    throw new Error(
      "Подписи работников ведёт ответственный представитель клиента — владельцу платформы они недоступны.",
    );
  }
}

// ─────────────────────────── Коды самозаписи ───────────────────────────

export const createInvitesAction = safeAction(
  {
    schema: z.object({
      orgId: z.string().optional(), // только для владельца платформы
      licenseIds: z.array(z.string()).min(1, "Выберите хотя бы один курс"),
      groupId: z.string().optional(),
      count: z.coerce.number().int().min(1).max(200).default(1),
      maxUses: z.coerce.number().int().min(1).max(500).default(1),
      expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
    }),
    auth: "orgAdmin",
  },
  async (input) => {
    const ctx = await writableCtx(input.orgId);

    // Лицензии и подразделение обязаны принадлежать этой организации.
    const licenses = await db.orgLicense.findMany({
      where: { id: { in: input.licenseIds } },
      select: {
        id: true,
        orgId: true,
        seatsTotal: true,
        course: { select: { title: true } },
        _count: { select: { enrollments: { where: { revokedAt: null } } } },
      },
    });
    if (licenses.length !== input.licenseIds.length) {
      throw new Error("Лицензия не найдена");
    }
    for (const l of licenses) assertOrgScope(l, ctx);

    // Код — это обещание места. Раньше их можно было напечатать сколько угодно,
    // и отказ прилетал работнику при вводе кода: место занимал первый, а
    // остальные видели «свободных мест нет» и шли выяснять к ответственному.
    const reserved = await getInviteReservations(ctx.orgId);
    for (const l of licenses) {
      const free = Math.max(0, l.seatsTotal - l._count.enrollments);
      const available = free - (reserved.get(l.id) ?? 0);
      const needed = input.count * input.maxUses;
      if (needed > available) {
        throw new Error(
          available <= 0
            ? `Свободных мест на курсе «${l.course.title}» не осталось: все ${l.seatsTotal} заняты работниками или обещаны уже выданными кодами. Отзовите ненужные коды или увеличьте лицензию.`
            : `На курсе «${l.course.title}» доступно мест: ${available} (занято работниками или обещано выданными кодами — ${l.seatsTotal - available} из ${l.seatsTotal}). Уменьшите количество кодов.`,
        );
      }
    }

    if (input.groupId) {
      const group = await db.orgGroup.findUnique({
        where: { id: input.groupId },
        select: { orgId: true },
      });
      assertOrgScope(group, ctx);
    }

    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 86_400_000)
      : null;

    const codes: string[] = [];
    for (let i = 0; i < input.count; i += 1) {
      const invite = await createInvite({
        orgId: ctx.orgId,
        licenseIds: input.licenseIds,
        groupId: input.groupId ?? null,
        maxUses: input.maxUses,
        expiresAt,
        createdBy: ctx.userId,
      });
      codes.push(invite.code);
    }

    await writeAdminLog({
      actorId: ctx.userId,
      action: "org.invite.create",
      meta: {
        orgId: ctx.orgId,
        count: input.count,
        licenseIds: input.licenseIds,
        maxUses: input.maxUses,
      },
    });

    revalidatePath("/org/invites");
    return { codes };
  },
);

export const revokeInviteAction = safeAction(
  {
    schema: z.object({ orgId: z.string().optional(), inviteId: z.string().min(1) }),
    auth: "orgAdmin",
  },
  async (input) => {
    const ctx = await writableCtx(input.orgId);
    const invite = await db.orgInvite.findUnique({
      where: { id: input.inviteId },
      select: { id: true, orgId: true },
    });
    assertOrgScope(invite, ctx);

    await db.orgInvite.update({
      where: { id: input.inviteId },
      data: { revokedAt: new Date() },
    });

    await writeAdminLog({
      actorId: ctx.userId,
      action: "org.invite.revoke",
      meta: { orgId: ctx.orgId, inviteId: input.inviteId },
    });

    revalidatePath("/org/invites");
    return { ok: true };
  },
);

/**
 * Удалить код из списка. Отзыв гасит код, но строка остаётся в таблице и
 * мешает читать список — поэтому неиспользованные коды можно убрать совсем.
 * Код, по которому уже зарегистрировался работник, не удаляется: он остаётся
 * единственным следом того, откуда взялось место (сам работник обезличен).
 */
export const deleteInviteAction = safeAction(
  {
    schema: z.object({ orgId: z.string().optional(), inviteId: z.string().min(1) }),
    auth: "orgAdmin",
  },
  async (input) => {
    const ctx = await writableCtx(input.orgId);
    const invite = await db.orgInvite.findUnique({
      where: { id: input.inviteId },
      select: { id: true, orgId: true, usedCount: true },
    });
    assertOrgScope(invite, ctx);
    if (invite!.usedCount > 0) {
      throw new Error(
        "По этому коду уже зарегистрировался работник — код остаётся в истории. Отозвать его можно, удалить нельзя.",
      );
    }

    await db.orgInvite.delete({ where: { id: input.inviteId } });

    await writeAdminLog({
      actorId: ctx.userId,
      action: "org.invite.delete",
      meta: { orgId: ctx.orgId, inviteId: input.inviteId },
    });

    revalidatePath("/org/invites");
    return { ok: true };
  },
);

/**
 * Убрать из списка все недействующие коды разом: отозванные и истёкшие, по
 * которым никто не зарегистрировался. Действующие коды не трогаем — они на
 * руках у работников.
 */
export const purgeInvitesAction = safeAction(
  {
    schema: z.object({ orgId: z.string().optional() }),
    auth: "orgAdmin",
  },
  async (input) => {
    const ctx = await writableCtx(input.orgId);
    const now = new Date();

    const { count } = await db.orgInvite.deleteMany({
      where: {
        orgId: ctx.orgId,
        usedCount: 0,
        OR: [{ revokedAt: { not: null } }, { expiresAt: { lt: now } }],
      },
    });

    await writeAdminLog({
      actorId: ctx.userId,
      action: "org.invite.purge",
      meta: { orgId: ctx.orgId, count },
    });

    revalidatePath("/org/invites");
    return { count };
  },
);

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
      // Метки работников — уже зашифрованные в браузере blob'ы (base64 AES-GCM),
      // по одной на создаваемого. Открытым текстом имени здесь быть не может:
      // поля name/email/phone в B2B-действиях запрещены схемой, а не только
      // спрятаны в UI (CLAUDE.md, правило 9).
      labels: z.array(z.string().max(2048).nullable()).max(100).optional(),
    }),
    auth: "orgAdmin",
  },
  async (input) => {
    const ctx = await writableCtx(input.orgId);

    // Метки и число работников считаются по одному индексу — рассинхрон означал
    // бы имя, приклеенное к чужому логину.
    if (input.labels && input.labels.length !== input.count) {
      throw new Error("Имена не совпали с числом работников — обновите страницу");
    }
    // Владелец платформы метки не пишет: как только он способен положить туда
    // имя, он становится оператором ПДн работников (оферта /offer-b2b, п. 10).
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

/** Сохранить зашифрованную метку работника. Сервер её не расшифровывает. */
export const setMemberLabelAction = safeAction(
  {
    schema: z.object({
      orgId: z.string().optional(),
      membershipId: z.string().min(1),
      // base64 blob AES-GCM; ограничение длины — защита от использования поля
      // как «блокнота» с открытым текстом.
      labelEnc: z.string().max(2048).nullable(),
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
      data: { labelEnc: input.labelEnc },
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

// ─────────────────────────── Ключ организации (L2) ───────────────────────────

/**
 * Схема одной обёртки. Сервер принимает только непрозрачные строки: ни ключа,
 * ни ПИН-кода, ни recovery-кода он не видит и видеть не должен.
 */
const wrapSchema = z.object({
  wrappedKey: z.string().min(16).max(512),
  kdfSalt: z.string().min(8).max(128),
  kdfParams: z.object({
    alg: z.literal("PBKDF2"),
    hash: z.literal("SHA-256"),
    iterations: z.number().int().min(100_000).max(5_000_000),
  }),
});

/**
 * Первичная настройка шифрования имён: сохраняем обёртку под ПИН-код
 * ответственного и обёртку под recovery-код. Повторный вызов при уже настроенном
 * ключе запрещён — иначе новый ключ сделал бы нечитаемыми все прежние имена.
 */
export const setupOrgKeyAction = safeAction(
  {
    schema: z.object({
      orgId: z.string().optional(),
      admin: wrapSchema,
      recovery: wrapSchema,
    }),
    auth: "orgAdmin",
  },
  async (input) => {
    const ctx = await writableCtx(input.orgId);
    assertNotOwnerView(ctx);

    const existing = await db.orgKeyWrap.count({ where: { orgId: ctx.orgId } });
    if (existing > 0) {
      throw new Error(
        "Шифрование уже настроено. Чтобы сменить код, войдите с текущей и используйте смену кода.",
      );
    }

    await db.$transaction([
      db.orgKeyWrap.create({
        data: {
          orgId: ctx.orgId,
          userId: ctx.userId,
          kind: "admin",
          wrappedKey: input.admin.wrappedKey,
          kdfSalt: input.admin.kdfSalt,
          kdfParams: input.admin.kdfParams,
        },
      }),
      db.orgKeyWrap.create({
        data: {
          orgId: ctx.orgId,
          userId: null,
          kind: "recovery",
          wrappedKey: input.recovery.wrappedKey,
          kdfSalt: input.recovery.kdfSalt,
          kdfParams: input.recovery.kdfParams,
        },
      }),
    ]);

    await writeAdminLog({
      actorId: ctx.userId,
      action: "org.key.setup",
      meta: { orgId: ctx.orgId, kind: "setup" },
    });

    revalidatePath(`/org/${ctx.orgId}`);
    return { ok: true };
  },
);

/**
 * Сменить свою ПИН-код или выдать доступ к меткам другому ответственному.
 * Клиент уже развернул ключ и заново обернул его под новый код — сервер лишь
 * заменяет blob.
 */
export const saveOrgKeyWrapAction = safeAction(
  {
    schema: z.object({
      orgId: z.string().optional(),
      /** Кому принадлежит обёртка: сам вызывающий или другой ORG_ADMIN. */
      targetUserId: z.string().optional(),
      kind: z.enum(["admin", "recovery"]),
      wrap: wrapSchema,
    }),
    auth: "orgAdmin",
  },
  async (input) => {
    const ctx = await writableCtx(input.orgId);
    assertNotOwnerView(ctx);

    const userId = input.kind === "recovery" ? null : (input.targetUserId ?? ctx.userId);

    if (userId && userId !== ctx.userId) {
      // Обёртку можно выдать только действующему ответственному этой организации.
      const membership = await db.orgMembership.findFirst({
        where: { orgId: ctx.orgId, userId, role: "ORG_ADMIN", isActive: true },
        select: { orgId: true },
      });
      assertOrgScope(membership, ctx);
    }

    // Recovery-обёртка одна на организацию: unique-индекс с NULL в Postgres
    // не помогает (NULL ≠ NULL), поэтому чистим прежнюю явно.
    if (input.kind === "recovery") {
      await db.orgKeyWrap.deleteMany({
        where: { orgId: ctx.orgId, kind: "recovery" },
      });
      await db.orgKeyWrap.create({
        data: {
          orgId: ctx.orgId,
          userId: null,
          kind: "recovery",
          wrappedKey: input.wrap.wrappedKey,
          kdfSalt: input.wrap.kdfSalt,
          kdfParams: input.wrap.kdfParams,
        },
      });
    } else {
      await db.orgKeyWrap.upsert({
        where: {
          orgId_userId_kind: { orgId: ctx.orgId, userId: userId!, kind: "admin" },
        },
        create: {
          orgId: ctx.orgId,
          userId,
          kind: "admin",
          wrappedKey: input.wrap.wrappedKey,
          kdfSalt: input.wrap.kdfSalt,
          kdfParams: input.wrap.kdfParams,
        },
        update: {
          wrappedKey: input.wrap.wrappedKey,
          kdfSalt: input.wrap.kdfSalt,
          kdfParams: input.wrap.kdfParams,
        },
      });
    }

    await writeAdminLog({
      actorId: ctx.userId,
      action: "org.key.setup",
      meta: { orgId: ctx.orgId, kind: input.kind, targetUserId: userId },
    });

    revalidatePath(`/org/${ctx.orgId}`);
    return { ok: true };
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
