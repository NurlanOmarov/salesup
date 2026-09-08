import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { computeSeatExpiry, computeSeatUsage, formatLogin } from "@/lib/org/seats";
import { hashPassword } from "@/lib/auth/password";
import { generateTempPassword } from "@/lib/auth/temp-password";

/**
 * Операции над местами и учётками работников. Используются и консолью владельца,
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

/**
 * Пересчитать счётчик логинов организации по фактически существующим учёткам.
 *
 * Нужен после удаления работника: счётчик только рос, и клиент, удаливший
 * единственного ошибочно созданного acme-0001, следующего получал уже как
 * acme-0002 — выглядело так, будто в компании учатся двое. Считаем максимум по
 * оставшимся логинам, а не по числу работников: учётка с сертификатом остаётся
 * в базе помеченной удалённой, и её номер переиспользовать нельзя (login
 * уникален глобально).
 *
 * Работает с транзакционным клиентом: вызывается внутри удаления, чтобы счётчик
 * и учётка менялись вместе.
 */
export async function recalcLoginSeq(
  tx: Pick<typeof db, "user" | "organization">,
  orgId: string,
  orgSlug: string,
): Promise<number> {
  const users = await tx.user.findMany({
    where: { login: { startsWith: `${orgSlug}-` } },
    select: { login: true },
  });
  const max = users.reduce((acc, u) => {
    const tail = u.login!.slice(orgSlug.length + 1);
    const n = /^\d+$/.test(tail) ? Number(tail) : 0;
    return n > acc ? n : acc;
  }, 0);
  await tx.organization.update({ where: { id: orgId }, data: { loginSeq: max } });
  return max;
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
  throw new SeatError(
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
  /**
   * Зашифрованные в браузере метки работников — по одной на создаваемого,
   * порядок совпадает с порядком выдачи логинов. Сервер видит только blob:
   * имя шифруется ключом организации до отправки (docs/B2B-PLAN.md §5.2).
   */
  labels?: (string | null)[];
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
          labelEnc: input.labels?.[i] ?? null,
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
 * Назначить ответственного представителя организации: учётка с e-mail (его ПДн
 * платформа обрабатывает как оператор — оферта, п. 10.7) + членство ORG_ADMIN.
 *
 * Пароль выдаётся ТОЛЬКО новой учётке. Если пользователь с таким e-mail уже
 * есть, мы назначаем ему роль и не трогаем пароль: иначе назначение молча
 * обнуляет доступ живому человеку — ровно так владелец платформы, указав в
 * форме собственный e-mail, лишился входа в свою же консоль. Утерянный пароль
 * восстанавливается отдельной кнопкой сброса, а не побочным эффектом.
 */
export async function createOrgAdmin(input: {
  orgId: string;
  email: string;
  name?: string | null;
}): Promise<{ userId: string; tempPassword: string | null; existed: boolean }> {
  const email = input.email.trim().toLowerCase();
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  // Владелец платформы входит в кабинет любого клиента через «режим владельца»
  // (requireOrgAdmin пропускает OWNER без членства) — понижать его до ORG_ADMIN
  // незачем, а последствия у такого назначения были бы неочевидные.
  if (existing?.role === "OWNER") {
    throw new SeatError(
      "Это учётная запись владельца платформы: она и так открывает кабинет любой организации. Укажите e-mail сотрудника клиента.",
    );
  }

  const tempPassword = existing ? null : generateTempPassword();

  const userId = await db.$transaction(async (tx) => {
    let id: string;
    if (existing) {
      id = existing.id;
    } else {
      const created = await tx.user.create({
        data: {
          email,
          name: input.name?.trim() || null,
          role: "STUDENT",
          passwordHash: await hashPassword(tempPassword!),
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

  return { userId, tempPassword, existed: Boolean(existing) };
}
