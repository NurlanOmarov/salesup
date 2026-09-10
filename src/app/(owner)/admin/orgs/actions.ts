"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/safe-action";
import { db } from "@/lib/db";
import { SITE_HOSTS } from "@/lib/seo/site-hosts";
import { writeAdminLog } from "@/lib/admin/log";
import { ACCESS_DURATIONS, computeExpiry } from "@/lib/admin/enrollment";
import { createOrgAdmin } from "@/lib/org/service";
import { getOrgProgressSnapshot } from "@/lib/org/reports";
import { generateTempPassword } from "@/lib/auth/temp-password";
import { hashPassword } from "@/lib/auth/password";
import { slugifyOrgName } from "@/lib/org/seats";
import { enqueue } from "@/lib/jobs/enqueue";

/**
 * Консоль владельца → организации (S5.x, docs/B2B-PLAN.md фаза 1).
 * Всё только для OWNER, каждое действие пишется в AdminLog с meta.orgId.
 *
 * Владелец делает ровно четыре вещи: заводит организацию, выдаёт лицензии,
 * назначает ответственного представителя и при неоплате замораживает доступ.
 * Дальше клиент обслуживает себя сам — ручных операций не прибавляется.
 */

const nameSchema = z.string().trim().min(2, "Укажите наименование организации");

/** Свободный slug: acme, acme-2, acme-3… — логины работников строятся из него. */
async function uniqueSlug(base: string): Promise<string> {
  const root = slugifyOrgName(base) || "org";
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const taken = await db.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  throw new Error("Не удалось подобрать код организации");
}

/** Создать организацию. Лицензии и ответственного добавляют следующим шагом. */
/**
 * Рынок клиента: определяет домен в готовых сообщениях (docs/MULTI-DOMAIN-PLAN.md).
 * Доступ он не ограничивает — учётка работает на любом из наших доменов.
 */
const siteSchema = z
  .enum(SITE_HOSTS.map((s) => s.code) as [string, ...string[]])
  .optional();

export const createOrgAction = safeAction(
  {
    schema: z.object({
      name: nameSchema,
      slug: z
        .string()
        .trim()
        .regex(/^[a-z0-9-]*$/, "Только строчная латиница, цифры и дефис")
        .optional(),
      unp: z.string().trim().optional(),
      contactEmail: z.string().trim().email("Некорректный e-mail").optional().or(z.literal("")),
      contactNote: z.string().trim().optional(),
      note: z.string().trim().optional(),
      site: siteSchema,
    }),
    auth: "owner",
  },
  async (input, { session }) => {
    const slug = await uniqueSlug(input.slug || input.name);

    const org = await db.organization.create({
      data: {
        name: input.name,
        slug,
        unp: input.unp || null,
        contactEmail: input.contactEmail || null,
        contactNote: input.contactNote || null,
        note: input.note || null,
        site: input.site ?? null,
      },
      select: { id: true, slug: true },
    });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "org.create",
      meta: { orgId: org.id, slug: org.slug, name: input.name },
    });

    revalidatePath("/admin/orgs");
    return { orgId: org.id, slug: org.slug };
  },
);

/** Изменить реквизиты и заметки организации. */
export const updateOrgAction = safeAction(
  {
    schema: z.object({
      orgId: z.string().min(1),
      name: nameSchema,
      unp: z.string().trim().optional(),
      contactEmail: z.string().trim().email("Некорректный e-mail").optional().or(z.literal("")),
      contactNote: z.string().trim().optional(),
      note: z.string().trim().optional(),
      site: siteSchema,
    }),
    auth: "owner",
  },
  async (input, { session }) => {
    await db.organization.update({
      where: { id: input.orgId },
      data: {
        name: input.name,
        unp: input.unp || null,
        contactEmail: input.contactEmail || null,
        contactNote: input.contactNote || null,
        note: input.note || null,
        site: input.site ?? null,
      },
    });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "org.update",
      meta: { orgId: input.orgId },
    });

    revalidatePath(`/admin/orgs/${input.orgId}`);
    return { ok: true };
  },
);

/**
 * Приостановить / возобновить / архивировать организацию.
 * Смена статуса не трогает доступы напрямую — ставит задачу org.sync-access,
 * которая приводит Enrollment в соответствие (единственный источник доступа).
 */
export const setOrgStatusAction = safeAction(
  {
    schema: z.object({
      orgId: z.string().min(1),
      status: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]),
    }),
    auth: "owner",
  },
  async (input, { session }) => {
    await db.organization.update({
      where: { id: input.orgId },
      data: { status: input.status },
    });

    await enqueue("org.sync-access", { orgId: input.orgId });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "org.status",
      meta: { orgId: input.orgId, status: input.status },
    });

    revalidatePath(`/admin/orgs/${input.orgId}`);
    revalidatePath("/admin/orgs");
    return { ok: true };
  },
);

/**
 * Удалить организацию со всем её содержимым: лицензии, коды, обёртки ключа,
 * членства, доступы и обезличенные учётки работников.
 *
 * Каскад в схеме сам по себе недостаточен: `Enrollment.licenseId` обнуляется
 * (SetNull), то есть доступ к курсам у работников пережил бы удаление
 * организации. Поэтому доступы снимаем явно, а сами учётки удаляем — иначе в
 * базе остаются вечные `acme-0042`, которые уже некому объяснить.
 *
 * Исключение — работники с сертификатами или заказами: `Certificate.userId` и
 * `Order.userId` держат пользователя без каскада, а публичная проверка
 * сертификата на /verify обязана продолжать работать. Такие учётки остаются,
 * но блокируются и лишаются доступа; сколько их — возвращаем вызывающему.
 */
export const deleteOrgAction = safeAction(
  {
    schema: z.object({
      orgId: z.string().min(1),
      /** Осознанное удаление непустой организации: набранное наименование. */
      confirmName: z.string().trim().optional(),
    }),
    auth: "owner",
  },
  async ({ orgId, confirmName }, { session }) => {
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: {
        name: true,
        slug: true,
        licenses: { select: { id: true } },
        memberships: { select: { userId: true, role: true } },
      },
    });
    if (!org) throw new Error("Организация не найдена");

    const licenseIds = org.licenses.map((l) => l.id);
    const learnerIds = org.memberships
      .filter((m) => m.role === "ORG_LEARNER")
      .map((m) => m.userId);
    const isEmpty = licenseIds.length === 0 && org.memberships.length === 0;

    // У непустой организации спрашиваем наименование: удаление уносит прогресс
    // работников, и «случайно нажал» здесь стоит слишком дорого.
    if (!isEmpty && confirmName !== org.name) {
      throw new Error(
        `Введите наименование организации точно так, как оно записано: «${org.name}»`,
      );
    }

    // Учётки, которые нельзя удалить: за ними стоят выданные сертификаты или
    // оплаченные заказы.
    const keepIds = learnerIds.length
      ? [
          ...new Set([
            ...(
              await db.certificate.findMany({
                where: { userId: { in: learnerIds } },
                select: { userId: true },
              })
            ).map((c) => c.userId),
            ...(
              await db.order.findMany({
                where: { userId: { in: learnerIds } },
                select: { userId: true },
              })
            ).map((o) => o.userId),
          ]),
        ]
      : [];
    const dropIds = learnerIds.filter((id) => !keepIds.includes(id));

    await db.$transaction(async (tx) => {
      // Доступы снимаем у всех работников организации — и у тех, чьи учётки
      // остаются.
      if (learnerIds.length) {
        await tx.enrollment.deleteMany({ where: { userId: { in: learnerIds } } });
      }
      if (licenseIds.length) {
        await tx.enrollment.updateMany({
          where: { licenseId: { in: licenseIds }, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: "Организация удалена" },
        });
      }
      if (keepIds.length) {
        await tx.user.updateMany({
          where: { id: { in: keepIds } },
          data: { deletedAt: new Date() },
        });
      }
      if (dropIds.length) {
        await tx.user.deleteMany({ where: { id: { in: dropIds } } });
      }
      await tx.organization.delete({ where: { id: orgId } });
    });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "org.delete",
      meta: {
        orgId,
        name: org.name,
        slug: org.slug,
        licenses: licenseIds.length,
        learnersDeleted: dropIds.length,
        learnersKept: keepIds.length,
      },
    });

    revalidatePath("/admin/orgs");
    return { learnersDeleted: dropIds.length, learnersKept: keepIds.length };
  },
);

/**
 * Сбросить ПИН-код имён работников. Владелец не получает доступа к именам —
 * он их уничтожает: обёртки ключа удаляются, а сами имена (labelEnc) стираются,
 * потому что без ключа это нечитаемый мусор, который уже никто не расшифрует.
 *
 * Нужно на случай «клиент забыл и ПИН, и код восстановления»: без сброса он не
 * может ни увидеть прежние имена, ни завести новые — setupOrgKeyAction
 * отказывает, пока обёртки существуют.
 */
export const resetOrgKeyAction = safeAction(
  {
    schema: z.object({ orgId: z.string().min(1) }),
    auth: "owner",
  },
  async ({ orgId }, { session }) => {
    const [wraps, labelled] = await Promise.all([
      db.orgKeyWrap.count({ where: { orgId } }),
      db.orgMembership.count({ where: { orgId, labelEnc: { not: null } } }),
    ]);
    if (wraps === 0) throw new Error("У организации не задан ПИН-код имён");

    await db.$transaction([
      db.orgKeyWrap.deleteMany({ where: { orgId } }),
      db.orgMembership.updateMany({
        where: { orgId, labelEnc: { not: null } },
        data: { labelEnc: null },
      }),
    ]);

    await writeAdminLog({
      actorId: session!.user.id,
      action: "org.key.reset",
      meta: { orgId, namesErased: labelled },
    });

    revalidatePath(`/admin/orgs/${orgId}`);
    return { namesErased: labelled };
  },
);

/**
 * Выдать лицензии сразу на все опубликованные курсы — модель «место в библиотеке»
 * (docs/PRICING-PLAN.md §8). Клиент покупает годовой доступ ко всей библиотеке, а
 * технически это набор лицензий: заводить их по одной руками бессмысленно.
 *
 * Цена места пишется в «якорную» лицензию (первую по порядку витрины), остальные
 * получают 0 — иначе выручка организации посчиталась бы кратно числу курсов.
 */
export const grantLibraryAction = safeAction(
  {
    schema: z.object({
      orgId: z.string().min(1),
      seatsTotal: z.coerce.number().int().min(1).max(10000),
      accessDuration: z.enum(ACCESS_DURATIONS),
      pricePerSeatTiyn: z.coerce.number().int().min(0).optional(),
      note: z.string().trim().optional(),
    }),
    auth: "owner",
  },
  async (input, { session }) => {
    const courses = await db.course.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    if (courses.length === 0) throw new Error("Нет опубликованных курсов");

    const now = new Date();
    const licenseIds: string[] = [];

    for (const [index, course] of courses.entries()) {
      const existing = await db.orgLicense.findUnique({
        where: { orgId_courseId: { orgId: input.orgId, courseId: course.id } },
        select: { id: true, startsAt: true },
      });
      const startsAt = existing?.startsAt ?? now;
      const expiresAt = computeExpiry(input.accessDuration, startsAt);
      const price = index === 0 ? (input.pricePerSeatTiyn ?? null) : 0;

      const license = await db.orgLicense.upsert({
        where: { orgId_courseId: { orgId: input.orgId, courseId: course.id } },
        create: {
          orgId: input.orgId,
          courseId: course.id,
          seatsTotal: input.seatsTotal,
          accessDuration: input.accessDuration,
          startsAt,
          expiresAt,
          priceTiyn: price,
          note: input.note || "Библиотека",
        },
        update: {
          seatsTotal: input.seatsTotal,
          accessDuration: input.accessDuration,
          expiresAt,
          priceTiyn: price,
          note: input.note || "Библиотека",
        },
        select: { id: true },
      });
      licenseIds.push(license.id);
    }

    await enqueue("org.sync-access", { orgId: input.orgId });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "org.license.grant",
      meta: {
        orgId: input.orgId,
        kind: "library",
        courses: courses.length,
        seatsTotal: input.seatsTotal,
        accessDuration: input.accessDuration,
        pricePerSeatTiyn: input.pricePerSeatTiyn ?? null,
      },
    });

    revalidatePath(`/admin/orgs/${input.orgId}`);
    return { licenses: licenseIds.length };
  },
);

/**
 * Выдать (или изменить) лицензию на ОДИН курс: курс × места × срок.
 * Единица лицензии — курс×человек, поэтому на курс в организации она одна:
 * повторная выдача того же курса меняет число мест, а не создаёт вторую запись.
 */
/**
 * Удалить лицензию — исправление ошибки выдачи, а не «отзыв доступа».
 *
 * Пока по лицензии открыт хоть один доступ, удаление запрещено: вместе с ней
 * оборвался бы доступ живого работника, и понять, почему у него исчез курс,
 * было бы неоткуда. Сначала закрыть места в кабинете, потом удалять лицензию.
 */
export const deleteLicenseAction = safeAction(
  {
    schema: z.object({
      orgId: z.string().min(1),
      licenseId: z.string().min(1),
    }),
    auth: "owner",
  },
  async (input, { session }) => {
    const license = await db.orgLicense.findUnique({
      where: { id: input.licenseId },
      select: {
        id: true,
        orgId: true,
        courseId: true,
        seatsTotal: true,
        course: { select: { title: true } },
      },
    });
    if (!license || license.orgId !== input.orgId) {
      throw new Error("Лицензия не найдена");
    }

    const used = await db.enrollment.count({
      where: { licenseId: license.id, revokedAt: null },
    });
    if (used > 0) {
      throw new Error(
        `По лицензии открыто мест: ${used}. Сначала закройте доступы работников — тогда лицензию можно будет удалить.`,
      );
    }

    // Отозванные места ссылались на лицензию: обнуляем ссылку, чтобы история
    // выдач у работника не исчезла вместе с ней (Enrollment.licenseId — SetNull).
    await db.orgLicense.delete({ where: { id: license.id } });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "org.license.delete",
      meta: {
        orgId: input.orgId,
        licenseId: license.id,
        courseId: license.courseId,
        courseTitle: license.course.title,
        seatsTotal: license.seatsTotal,
      },
    });

    revalidatePath(`/admin/orgs/${input.orgId}`);
    return { courseTitle: license.course.title };
  },
);

export const grantLicenseAction = safeAction(
  {
    schema: z.object({
      orgId: z.string().min(1),
      courseId: z.string().min(1),
      seatsTotal: z.coerce.number().int().min(1, "Минимум одно место").max(10000),
      accessDuration: z.enum(ACCESS_DURATIONS),
      priceTiyn: z.coerce.number().int().min(0).optional(),
      note: z.string().trim().optional(),
    }),
    auth: "owner",
  },
  async (input, { session }) => {
    const now = new Date();
    const existing = await db.orgLicense.findUnique({
      where: { orgId_courseId: { orgId: input.orgId, courseId: input.courseId } },
      select: { id: true, seatsTotal: true, startsAt: true },
    });

    // Срок лицензии считается от даты выдачи (оферта, п. 4.5). При расширении
    // существующей лицензии точку отсчёта не сдвигаем — иначе клиент получит
    // лишние месяцы просто за докупку мест.
    const startsAt = existing?.startsAt ?? now;
    const expiresAt = computeExpiry(input.accessDuration, startsAt);

    const license = await db.orgLicense.upsert({
      where: { orgId_courseId: { orgId: input.orgId, courseId: input.courseId } },
      create: {
        orgId: input.orgId,
        courseId: input.courseId,
        seatsTotal: input.seatsTotal,
        accessDuration: input.accessDuration,
        startsAt,
        expiresAt,
        priceTiyn: input.priceTiyn ?? null,
        note: input.note || null,
      },
      update: {
        seatsTotal: input.seatsTotal,
        accessDuration: input.accessDuration,
        expiresAt,
        priceTiyn: input.priceTiyn ?? null,
        note: input.note || null,
      },
      select: { id: true },
    });

    // Срок мог измениться — подтягиваем сроки уже выданных мест.
    await enqueue("org.sync-access", { orgId: input.orgId });

    await writeAdminLog({
      actorId: session!.user.id,
      action: existing ? "org.license.update" : "org.license.grant",
      meta: {
        orgId: input.orgId,
        licenseId: license.id,
        courseId: input.courseId,
        seatsTotal: input.seatsTotal,
        accessDuration: input.accessDuration,
        seatsBefore: existing?.seatsTotal ?? null,
      },
    });

    revalidatePath(`/admin/orgs/${input.orgId}`);
    return { licenseId: license.id };
  },
);

/**
 * Назначить ответственного представителя: учётка с e-mail + роль ORG_ADMIN.
 * Временный пароль показывается владельцу один раз — передаёт его он лично.
 * Существующей учётке пароль не меняется (см. createOrgAdmin), поэтому
 * tempPassword в ответе может быть null.
 */
export const createOrgAdminAction = safeAction(
  {
    schema: z.object({
      orgId: z.string().min(1),
      email: z.string().trim().email("Введите корректный e-mail"),
      name: z.string().trim().optional(),
    }),
    auth: "owner",
  },
  async (input, { session }) => {
    const { userId, tempPassword, existed } = await createOrgAdmin({
      orgId: input.orgId,
      email: input.email,
      name: input.name,
    });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "org.admin.create",
      targetUserId: userId,
      meta: { orgId: input.orgId, existed },
    });

    revalidatePath(`/admin/orgs/${input.orgId}`);
    return { userId, email: input.email.trim().toLowerCase(), tempPassword, existed };
  },
);

/**
 * Поправить данные уже назначенного представителя: e-mail (он же логин) и имя.
 * Нужно чаще, чем кажется: адрес диктуют по телефону и ошибаются в нём, а
 * «сменить ответственного» у клиента обычно означает передать кабинет другому
 * человеку, а не завести второго. Пароль при этом не меняется — если новый
 * человек его не знает, рядом есть «сбросить пароль».
 */
export const updateOrgAdminAction = safeAction(
  {
    schema: z.object({
      orgId: z.string().min(1),
      userId: z.string().min(1),
      email: z.string().trim().email("Введите корректный e-mail"),
      name: z.string().trim().optional(),
    }),
    auth: "owner",
  },
  async (input, { session }) => {
    const membership = await db.orgMembership.findUnique({
      where: { orgId_userId: { orgId: input.orgId, userId: input.userId } },
      select: { role: true, user: { select: { email: true } } },
    });
    if (!membership || membership.role !== "ORG_ADMIN") {
      throw new Error("Этот пользователь не назначен ответственным в организации");
    }

    const email = input.email.toLowerCase();
    if (email !== membership.user.email) {
      const taken = await db.user.findUnique({ where: { email }, select: { id: true } });
      if (taken && taken.id !== input.userId) {
        throw new Error(
          "Этот e-mail уже занят другой учётной записью. Назначьте её ответственной отдельно или укажите другой адрес.",
        );
      }
    }

    await db.user.update({
      where: { id: input.userId },
      data: { email, name: input.name?.trim() || null },
    });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "org.admin.update",
      targetUserId: input.userId,
      meta: { orgId: input.orgId, emailChanged: email !== membership.user.email },
    });

    revalidatePath(`/admin/orgs/${input.orgId}`);
    return { email };
  },
);

/**
 * Снять человека с роли ответственного: учётка остаётся, доступ в кабинет
 * организации пропадает. Так выглядит увольнение и передача кабинета другому —
 * иначе у клиента копятся представители, которых уже нет в компании.
 */
export const removeOrgAdminAction = safeAction(
  {
    schema: z.object({ orgId: z.string().min(1), userId: z.string().min(1) }),
    auth: "owner",
  },
  async (input, { session }) => {
    const membership = await db.orgMembership.findUnique({
      where: { orgId_userId: { orgId: input.orgId, userId: input.userId } },
      select: { role: true },
    });
    if (!membership || membership.role !== "ORG_ADMIN") {
      throw new Error("Этот пользователь не назначен ответственным в организации");
    }

    await db.orgMembership.delete({
      where: { orgId_userId: { orgId: input.orgId, userId: input.userId } },
    });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "org.admin.remove",
      targetUserId: input.userId,
      meta: { orgId: input.orgId },
    });

    revalidatePath(`/admin/orgs/${input.orgId}`);
    return { ok: true };
  },
);

/**
 * Выдать ответственному новый временный пароль. Первый пароль показывается один
 * раз при назначении, и если он потерян, восстановить его неоткуда — учётка
 * ORG_ADMIN заводится владельцем, а не самозаписью, и почтовой рассылки в MVP
 * нет. Проверка членства обязательна: без неё сюда можно подставить чужой
 * userId и сбросить пароль любому пользователю платформы.
 */
export const resetOrgAdminPasswordAction = safeAction(
  {
    schema: z.object({ orgId: z.string().min(1), userId: z.string().min(1) }),
    auth: "owner",
  },
  async (input, { session }) => {
    const membership = await db.orgMembership.findUnique({
      where: { orgId_userId: { orgId: input.orgId, userId: input.userId } },
      select: { role: true, user: { select: { email: true } } },
    });
    if (!membership || membership.role !== "ORG_ADMIN") {
      throw new Error("Этот пользователь не назначен ответственным в организации");
    }

    const tempPassword = generateTempPassword();
    await db.user.update({
      where: { id: input.userId },
      data: {
        passwordHash: await hashPassword(tempPassword),
        mustChangePassword: true,
      },
    });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "password.reset",
      targetUserId: input.userId,
      meta: { orgId: input.orgId, role: "ORG_ADMIN" },
    });

    revalidatePath(`/admin/orgs/${input.orgId}`);
    return { tempPassword, email: membership.user.email ?? "" };
  },
);

/** Процент демо-доступа: 0–100 либо null — «полный доступ». */
const demoPercentSchema = z.coerce.number().int().min(0).max(100).nullable();

/**
 * Демо-доступ по лицензии: клиент видит первые N% уроков курса, дальше — пейволл
 * (lib/access.demoLessonCount). Одна ручка на всю компанию: лимит наследуют и уже
 * выданные места, и те, что работники займут сами позже. Оплатили — ставим null,
 * курс открывается у всех разом, переоформлять места не нужно.
 */
export const setLicenseDemoAction = safeAction(
  {
    schema: z.object({
      orgId: z.string().min(1),
      licenseId: z.string().min(1),
      percent: demoPercentSchema,
    }),
    auth: "owner",
  },
  async (input, { session }) => {
    const license = await db.orgLicense.findUnique({
      where: { id: input.licenseId },
      select: { id: true, orgId: true, demoPercent: true, course: { select: { title: true } } },
    });
    if (!license || license.orgId !== input.orgId) throw new Error("Лицензия не найдена");

    await db.orgLicense.update({
      where: { id: license.id },
      data: { demoPercent: input.percent },
    });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "org.license.demo",
      meta: {
        orgId: input.orgId,
        licenseId: license.id,
        percentBefore: license.demoPercent,
        percent: input.percent,
      },
    });

    revalidatePath(`/admin/orgs/${input.orgId}`);
    return { courseTitle: license.course.title, percent: input.percent };
  },
);

/** То же самое сразу по всем лицензиям организации — «бесплатный клиент» одним движением. */
export const setOrgDemoAction = safeAction(
  {
    schema: z.object({ orgId: z.string().min(1), percent: demoPercentSchema }),
    auth: "owner",
  },
  async (input, { session }) => {
    const updated = await db.orgLicense.updateMany({
      where: { orgId: input.orgId },
      data: { demoPercent: input.percent },
    });

    // Индивидуальные переопределения на местах перекрывали бы лицензию и делали
    // бы массовое действие наполовину рабочим: снимаем их, лицензия остаётся
    // единственным источником правды по демо для этой компании.
    await db.enrollment.updateMany({
      where: { license: { orgId: input.orgId }, demoPercent: { not: null } },
      data: { demoPercent: null },
    });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "org.demo",
      meta: { orgId: input.orgId, percent: input.percent, licenses: updated.count },
    });

    revalidatePath(`/admin/orgs/${input.orgId}`);
    return { licenses: updated.count, percent: input.percent };
  },
);

/**
 * Как учится компания — для модального окна в реестре клиентов. Чтение, а не
 * мутация: журнал действий не пишем, иначе он забьётся просмотрами.
 */
export const orgProgressAction = safeAction(
  { schema: z.object({ orgId: z.string().min(1) }), auth: "owner" },
  async (input) => {
    const snapshot = await getOrgProgressSnapshot(input.orgId);
    if (!snapshot) throw new Error("Организация не найдена");
    return snapshot;
  },
);
