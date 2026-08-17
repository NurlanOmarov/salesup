import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  computeSeatExpiry,
  computeSeatUsage,
  formatInviteCode,
  formatLogin,
  INVITE_CODE_LENGTH,
  isInviteUsable,
  normalizeInviteCode,
} from "@/lib/org/seats";
import { hashPassword } from "@/lib/auth/password";
import { generateTempPassword } from "@/lib/auth/temp-password";

/**
 * Операции над местами и кодами самозаписи. Используются и консолью владельца,
 * и кабинетом организации — поэтому живут в lib, а не в actions конкретной зоны.
 *
 * Инвариант: место = обычный Enrollment (source B2B, licenseId). Никакой второй
 * ветки доступа не создаётся — lib/access.ts об организациях не знает (правило 1).
 */

export class SeatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeatError";
  }
}

/**
 * Выдать работнику место из лицензии. Транзакция + повторная проверка занятости
 * внутри неё: два org-админа могут жать кнопку одновременно, и лицензия не должна
 * уйти в минус по местам.
 */
export async function grantSeat(input: {
  orgId: string;
  userId: string;
  licenseId: string;
  now?: Date;
  tx?: Prisma.TransactionClient;
}): Promise<{ enrollmentId: string }> {
  const now = input.now ?? new Date();
  const run = async (tx: Prisma.TransactionClient) => {
    const license = await tx.orgLicense.findUnique({
      where: { id: input.licenseId },
      select: {
        id: true,
        orgId: true,
        courseId: true,
        seatsTotal: true,
        accessDuration: true,
        expiresAt: true,
      },
    });
    if (!license || license.orgId !== input.orgId) {
      throw new SeatError("Лицензия не найдена");
    }

    const used = await tx.enrollment.count({
      where: { licenseId: license.id, revokedAt: null },
    });
    const usage = computeSeatUsage({
      seatsTotal: license.seatsTotal,
      activeEnrollments: used,
    });

    // Уже открытый этому работнику курс переоткрываем без расхода нового места.
    const existing = await tx.enrollment.findUnique({
      where: {
        userId_courseId: { userId: input.userId, courseId: license.courseId },
      },
      select: { id: true, revokedAt: true },
    });

    if (!existing && usage.free <= 0) {
      throw new SeatError(
        `Свободных мест нет: занято ${usage.used} из ${usage.total}. Отзовите место или увеличьте лицензию.`,
      );
    }

    const expiresAt = computeSeatExpiry({
      accessDuration: license.accessDuration,
      licenseExpiresAt: license.expiresAt,
      from: now,
    });

    const enrollment = await tx.enrollment.upsert({
      where: {
        userId_courseId: { userId: input.userId, courseId: license.courseId },
      },
      create: {
        userId: input.userId,
        courseId: license.courseId,
        licenseId: license.id,
        source: "B2B",
        startsAt: now,
        expiresAt,
      },
      update: {
        licenseId: license.id,
        source: "B2B",
        startsAt: now,
        expiresAt,
        revokedAt: null,
      },
      select: { id: true },
    });

    return { enrollmentId: enrollment.id };
  };

  return input.tx ? run(input.tx) : db.$transaction(run);
}

/**
 * Отозвать место (увольнение работника). Место возвращается в пул и может быть
 * передано другому — оферта, п. 4.4. Прогресс прежнего работника сохраняется,
 * но новому не передаётся: у него своя учётка.
 */
export async function revokeSeat(input: {
  orgId: string;
  enrollmentId: string;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  const enrollment = await db.enrollment.findUnique({
    where: { id: input.enrollmentId },
    select: { id: true, revokedAt: true, license: { select: { orgId: true } } },
  });
  if (!enrollment || enrollment.license?.orgId !== input.orgId) {
    throw new SeatError("Место не найдено");
  }
  if (enrollment.revokedAt) return;

  await db.enrollment.update({
    where: { id: enrollment.id },
    data: { revokedAt: now },
  });
}

/** Сгенерировать код самозаписи, не совпадающий с существующими. */
export async function createInvite(input: {
  orgId: string;
  licenseIds: string[];
  groupId?: string | null;
  maxUses?: number;
  expiresAt?: Date | null;
  createdBy?: string | null;
}): Promise<{ id: string; code: string }> {
  // Коллизия кода из 31^8 вариантов маловероятна, но уникальность обеспечена
  // индексом — просто пробуем ещё раз.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = formatInviteCode(randomBytes(INVITE_CODE_LENGTH));
    const exists = await db.orgInvite.findUnique({
      where: { code },
      select: { id: true },
    });
    if (exists) continue;

    const invite = await db.orgInvite.create({
      data: {
        orgId: input.orgId,
        code,
        licenseIds: input.licenseIds,
        groupId: input.groupId ?? null,
        maxUses: input.maxUses ?? 1,
        expiresAt: input.expiresAt ?? null,
        createdBy: input.createdBy ?? null,
      },
      select: { id: true, code: true },
    });
    return invite;
  }
  throw new SeatError("Не удалось сгенерировать код, попробуйте ещё раз");
}

export class JoinError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JoinError";
  }
}

/**
 * Самозапись работника по коду (оферта, п. 4.2) — ключевая операция обезличивания:
 * создаётся учётка БЕЗ e-mail, имени и телефона. Логин генерируется платформой из
 * счётчика организации, пароль работник задаёт сам. Мы не знаем, кто это.
 *
 * Всё в одной транзакции: инкремент счётчика логинов, создание пользователя,
 * членства и мест по всем лицензиям кода, инкремент usedCount.
 */
export async function activateInvite(input: {
  code: string;
  password: string;
  now?: Date;
}): Promise<{ userId: string; login: string; courses: number }> {
  const now = input.now ?? new Date();
  const code = normalizeInviteCode(input.code);
  const passwordHash = await hashPassword(input.password);

  // Логин выделяем ДО транзакции и повторяем при коллизии. Номер берётся из
  // счётчика организации, но занятым он может оказаться и без гонки: работники
  // удалённой организации остаются в базе, а новая организация с тем же кодом
  // начинает нумерацию сначала. Раньше это приводило к 500 на странице
  // регистрации — работник видел «ошибка сервера» вместо понятного текста.
  const inviteOrg = await db.orgInvite.findUnique({
    where: { code },
    select: { orgId: true },
  });
  if (!inviteOrg) throw new JoinError("Код не найден. Проверьте, верно ли он введён.");
  const login = await allocateLogin(inviteOrg.orgId);

  return db.$transaction(async (tx) => {
    const invite = await tx.orgInvite.findUnique({
      where: { code },
      select: {
        id: true,
        orgId: true,
        groupId: true,
        licenseIds: true,
        maxUses: true,
        usedCount: true,
        expiresAt: true,
        revokedAt: true,
        org: { select: { id: true, slug: true, status: true, loginSeq: true } },
      },
    });
    if (!invite) throw new JoinError("Код не найден. Проверьте, верно ли он введён.");
    if (!isInviteUsable(invite, now)) {
      throw new JoinError("Код больше не действует. Запросите новый у своей компании.");
    }
    if (invite.org.status !== "ACTIVE") {
      throw new JoinError("Доступ организации приостановлен. Обратитесь к ответственному за обучение.");
    }

    const user = await tx.user.create({
      data: {
        login,
        // e-mail, имя и телефон НЕ заполняются: платформа не получает ПДн
        // работника (оферта /offer-b2b, п. 10.1; docs/B2B-PLAN.md §5.1).
        role: "STUDENT",
        passwordHash,
        mustChangePassword: false, // пароль работник задал сам
      },
      select: { id: true },
    });

    await tx.orgMembership.create({
      data: {
        orgId: invite.orgId,
        userId: user.id,
        role: "ORG_LEARNER",
        groupId: invite.groupId,
      },
    });

    const licenseIds = Array.isArray(invite.licenseIds)
      ? (invite.licenseIds as unknown[]).filter(
          (v): v is string => typeof v === "string",
        )
      : [];

    let granted = 0;
    for (const licenseId of licenseIds) {
      await grantSeat({
        orgId: invite.orgId,
        userId: user.id,
        licenseId,
        now,
        tx,
      });
      granted += 1;
    }

    await tx.orgInvite.update({
      where: { id: invite.id },
      data: { usedCount: { increment: 1 } },
    });

    return { userId: user.id, login, courses: granted };
  });
}

/**
 * Выделить свободный логин работника: `<slug>-0042`.
 *
 * Счётчик организации инкрементируется вне транзакции регистрации — «дырки» в
 * нумерации допустимы и безопасны, а вот выдать занятый логин нельзя: unique-индекс
 * уронил бы всю самозапись. Проверяем занятость и при необходимости берём
 * следующий номер.
 */
async function allocateLogin(orgId: string): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const org = await db.organization.update({
      where: { id: orgId },
      data: { loginSeq: { increment: 1 } },
      select: { slug: true, loginSeq: true },
    });
    const login = formatLogin(org.slug, org.loginSeq);
    const taken = await db.user.findUnique({
      where: { login },
      select: { id: true },
    });
    if (!taken) return login;
  }
  throw new JoinError(
    "Не удалось создать учётную запись. Обратитесь к ответственному за обучение.",
  );
}

export interface CreatedMember {
  login: string;
  password: string;
}

/**
 * Создать сразу несколько учётных записей работников — на случай «заведите нам
 * десять человек прямо сейчас», когда объяснять сотрудникам регистрацию по коду
 * некогда.
 *
 * Обезличивание сохраняется: учётки создаются без e-mail, имени и телефона, под
 * теми же логинами `acme-0042`. Разница только в том, что пароль генерирует
 * платформа, а не работник, — поэтому он временный и меняется при первом входе.
 *
 * Пароли возвращаются вызывающему ОДИН раз: в базе лежит только их хеш.
 */
export async function createMembers(input: {
  orgId: string;
  count: number;
  licenseIds: string[];
  groupId?: string | null;
  now?: Date;
}): Promise<CreatedMember[]> {
  const now = input.now ?? new Date();

  // Свободных мест может не хватить на всех: проверяем заранее, чтобы не создать
  // учётки, которым нечего открыть.
  for (const licenseId of input.licenseIds) {
    const license = await db.orgLicense.findUnique({
      where: { id: licenseId },
      select: { seatsTotal: true, orgId: true, course: { select: { title: true } } },
    });
    if (!license || license.orgId !== input.orgId) {
      throw new SeatError("Лицензия не найдена");
    }
    const used = await db.enrollment.count({
      where: { licenseId, revokedAt: null },
    });
    const free = Math.max(0, license.seatsTotal - used);
    if (free < input.count) {
      throw new SeatError(
        `Свободных мест на курсе «${license.course.title}» — ${free}, а работников создаётся ${input.count}.`,
      );
    }
  }

  const created: CreatedMember[] = [];
  for (let i = 0; i < input.count; i += 1) {
    const login = await allocateLogin(input.orgId);
    const password = generateTempPassword();
    const passwordHash = await hashPassword(password);

    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          login,
          // ПДн не собираем и здесь: ни e-mail, ни имени, ни телефона.
          role: "STUDENT",
          passwordHash,
          mustChangePassword: true,
        },
        select: { id: true },
      });

      await tx.orgMembership.create({
        data: {
          orgId: input.orgId,
          userId: user.id,
          role: "ORG_LEARNER",
          groupId: input.groupId ?? null,
        },
      });

      for (const licenseId of input.licenseIds) {
        await grantSeat({ orgId: input.orgId, userId: user.id, licenseId, now, tx });
      }
    });

    created.push({ login, password });
  }

  return created;
}

/**
 * Создать ответственного представителя организации: обычная учётка с e-mail
 * (его ПДн платформа обрабатывает как оператор — оферта, п. 10.7) + членство
 * ORG_ADMIN. Возвращает временный пароль, который показывается владельцу один раз.
 */
export async function createOrgAdmin(input: {
  orgId: string;
  email: string;
  name?: string | null;
}): Promise<{ userId: string; tempPassword: string }> {
  const email = input.email.trim().toLowerCase();
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const userId = await db.$transaction(async (tx) => {
    let id: string;
    if (existing) {
      // Уже есть учётка (например, розничный ученик) — не плодим вторую,
      // назначаем её ответственным представителем и выдаём новый пароль.
      await tx.user.update({
        where: { id: existing.id },
        data: { passwordHash, mustChangePassword: true },
      });
      id = existing.id;
    } else {
      const created = await tx.user.create({
        data: {
          email,
          name: input.name?.trim() || null,
          role: "STUDENT",
          passwordHash,
          mustChangePassword: true,
        },
        select: { id: true },
      });
      id = created.id;
    }

    await tx.orgMembership.upsert({
      where: { orgId_userId: { orgId: input.orgId, userId: id } },
      create: {
        orgId: input.orgId,
        userId: id,
        role: "ORG_ADMIN",
      },
      update: { role: "ORG_ADMIN", isActive: true, deactivatedAt: null },
    });

    return id;
  });

  return { userId, tempPassword };
}
