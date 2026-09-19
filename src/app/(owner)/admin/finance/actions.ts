"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/safe-action";
import { db } from "@/lib/db";
import { writeAdminLog } from "@/lib/admin/log";
import { createIncome, deleteIncome } from "@/lib/finance/service";
import { COUNTRIES, INCOME_CURRENCIES } from "@/lib/finance/split";

/** Консоль владельца → доходы. Только OWNER, каждое действие — в AdminLog. */

/** «44 000», «44000,50» → минорные единицы. */
const money = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s ]/g, "").replace(",", "."))
  .refine((s) => /^\d+(\.\d{1,2})?$/.test(s), "Введите сумму числом")
  .transform((s) => Math.round(Number(s) * 100));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s || null)
    .nullable()
    .optional()
    .transform((v) => v ?? null);

// Схемы — константами модуля, а не внутри safeAction(...): в файле "use server"
// Next запрещает неасинхронные функции в экспортируемом выражении, и стрелки
// zod (refine/transform) внутри вызова роняли production-сборку.
const createIncomeSchema = z
  .object({
    receivedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату получения оплаты"),
    channel: z.enum(["B2B", "B2C"]),
    country: z.enum(COUNTRIES),
    currency: z.enum(INCOME_CURRENCIES),
    gross: money.refine((v) => v > 0, "Сумма должна быть больше нуля"),
    // Пусто — налог по ставке страны.
    tax: z
      .union([z.literal(""), money])
      .transform((v) => (v === "" ? null : v)),
    authorId: z.string().min(1, "Выберите автора"),
    orgId: optionalText(40),
    courseId: optionalText(40),
    // B2C — только номер заказа или пометка, без ФИО и контактов покупателя.
    buyerRef: optionalText(80),
    note: optionalText(500),
  })
  .refine((v) => v.channel === "B2C" || v.orgId, {
    message: "Выберите организацию",
    path: ["orgId"],
  });

const financeSettingsSchema = z.object({
  // Процент строкой: «11,364» → 11364.
  rates: z.array(
    z.object({
      country: z.enum(COUNTRIES),
      percent: z
        .string()
        .trim()
        .transform((s) => s.replace(",", "."))
        .refine(
          (s) => /^\d{1,2}(\.\d{1,3})?$/.test(s),
          "Ставка — число от 0 до 99,999",
        )
        .transform((s) => Math.round(Number(s) * 1000)),
    }),
  ),
  shares: z.array(
    z.object({
      payeeId: z.string().min(1),
      percent: z
        .string()
        .trim()
        .transform((s) => s.replace(",", "."))
        .refine(
          (s) => /^\d{1,3}(\.\d{1,2})?$/.test(s),
          "Доля — число от 0 до 100",
        )
        .transform((s) => Math.round(Number(s) * 100)),
    }),
  ),
});

export const createIncomeAction = safeAction(
  {
    schema: createIncomeSchema,
    auth: "owner",
  },
  async (input, { session }) => {
    const income = await createIncome(
      {
        receivedAt: new Date(`${input.receivedAt}T00:00:00Z`),
        channel: input.channel,
        country: input.country,
        currency: input.currency,
        grossTiyn: input.gross,
        taxTiyn: input.tax,
        authorId: input.authorId,
        orgId: input.orgId,
        courseId: input.courseId,
        buyerRef: input.buyerRef,
        note: input.note,
      },
      session!.user.id,
    );
    revalidatePath("/admin/finance");
    revalidatePath("/admin/orgs");
    return { id: income.id };
  },
);

export const deleteIncomeAction = safeAction(
  { schema: z.object({ id: z.string().min(1) }), auth: "owner" },
  async (input, { session }) => {
    await deleteIncome(input.id, session!.user.id);
    revalidatePath("/admin/finance");
    return { ok: true };
  },
);

export const updateFinanceSettingsAction = safeAction(
  {
    schema: financeSettingsSchema,
    auth: "owner",
  },
  async (input, { session }) => {
    const total = input.shares.reduce((s, x) => s + x.percent, 0);
    if (total > 10_000)
      throw new Error("Доли совладельцев в сумме больше 100%");

    await db.$transaction(async (tx) => {
      for (const r of input.rates) {
        await tx.taxRate.upsert({
          where: { country: r.country },
          create: { country: r.country, rateMilli: r.percent },
          update: { rateMilli: r.percent },
        });
      }
      for (const s of input.shares) {
        await tx.payee.updateMany({
          where: { id: s.payeeId, role: "CO_OWNER" },
          data: { shareBp: s.percent },
        });
      }
      await writeAdminLog({
        actorId: session!.user.id,
        action: "finance.settings.update",
        meta: { rates: input.rates, shares: input.shares },
        tx,
      });
    });
    revalidatePath("/admin/finance");
    return { ok: true };
  },
);
