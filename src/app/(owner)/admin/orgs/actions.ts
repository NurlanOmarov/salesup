"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/safe-action";
import { db } from "@/lib/db";
import { writeAdminLog } from "@/lib/admin/log";
import { ACCESS_DURATIONS, computeExpiry } from "@/lib/admin/enrollment";
import { createOrgAdmin } from "@/lib/org/service";
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
 * Удалить организацию безвозвратно. Разрешено только для «пустой» карточки —
 * без лицензий, работников и назначенных представителей: удаление организации с
 * реальной историей не отзывает доступ автоматически (Enrollment переживает
 * каскад через licenseId SetNull), так что это отдельная, более осторожная
 * операция, которую здесь намеренно не делаем. На практике это чистит дубли/
 * тестовые записи вроде тех, что оставляет повторный клик по «Создать» при сбое.
 */
export const deleteOrgAction = safeAction(
  {
    schema: z.object({ orgId: z.string().min(1) }),
    auth: "owner",
  },
  async ({ orgId }, { session }) => {
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: {
        name: true,
        slug: true,
        _count: { select: { licenses: true, memberships: { where: { isActive: true } } } },
      },
    });
    if (!org) throw new Error("Организация не найдена");
    if (org._count.licenses > 0 || org._count.memberships > 0) {
      throw new Error(
        "Нельзя удалить: у организации есть лицензии или работники. Сначала отзовите их или заархивируйте организацию.",
      );
    }

    await db.organization.delete({ where: { id: orgId } });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "org.delete",
      meta: { orgId, name: org.name, slug: org.slug },
    });

    revalidatePath("/admin/orgs");
    return { ok: true };
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
    const { userId, tempPassword } = await createOrgAdmin({
      orgId: input.orgId,
      email: input.email,
      name: input.name,
    });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "org.admin.create",
      targetUserId: userId,
      meta: { orgId: input.orgId },
    });

    revalidatePath(`/admin/orgs/${input.orgId}`);
    return { userId, email: input.email.trim().toLowerCase(), tempPassword };
  },
);
