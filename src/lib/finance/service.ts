import { db } from "@/lib/db";
import { writeAdminLog } from "@/lib/admin/log";
import { incomeWhere, type IncomeFilters } from "./filters";
import { needsFreshFx } from "./fx";
import { currentFx } from "./rates";
import { payeeGross, splitIncome, type Country } from "./split";

/**
 * Учёт доходов: запись поступления с раскладкой по получателям и сводки для
 * /admin/finance. Ставка налога и доли фиксируются в записи на момент ввода —
 * правка настроек потом не переписывает прошлые выплаты.
 */

export async function getFinanceSettings() {
  const [rates, payees] = await Promise.all([
    db.taxRate.findMany({ orderBy: { country: "asc" } }),
    db.payee.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
  ]);
  return { rates, payees };
}

export interface CreateIncomeInput {
  receivedAt: Date;
  channel: "B2B" | "B2C";
  country: Country;
  currency: string;
  grossTiyn: number;
  /** null — по ставке страны. */
  taxTiyn: number | null;
  authorId: string;
  orgId: string | null;
  courseId: string | null;
  buyerRef: string | null;
  note: string | null;
}

export async function createIncome(input: CreateIncomeInput, actorId: string) {
  const [rate, coOwners, author, fx] = await Promise.all([
    db.taxRate.findUnique({ where: { country: input.country } }),
    db.payee.findMany({ where: { role: "CO_OWNER", isActive: true } }),
    db.payee.findUnique({ where: { id: input.authorId } }),
    // Курс запоминаем на момент записи: журнал показывает поступление в двух
    // валютах, и пересчёт не должен меняться каждый день (lib/finance/fx).
    currentFx(input.currency),
  ]);
  if (!rate) throw new Error(`Не задана ставка налогов для страны ${input.country}`);
  if (!author || author.role !== "AUTHOR" || !author.isActive) {
    throw new Error("Выберите автора курса");
  }

  const split = splitIncome({
    grossTiyn: input.grossTiyn,
    rateMilli: rate.rateMilli,
    currency: input.currency,
    coOwners,
    author,
    taxTiyn: input.taxTiyn,
  });

  return db.$transaction(async (tx) => {
    const income = await tx.income.create({
      data: {
        receivedAt: input.receivedAt,
        channel: input.channel,
        country: input.country,
        currency: input.currency,
        grossTiyn: input.grossTiyn,
        rateMilli: rate.rateMilli,
        taxTiyn: split.taxTiyn,
        netTiyn: split.netTiyn,
        kztPerUnitMicro: fx.kztPerUnitMicro,
        kztPerBynMicro: fx.kztPerBynMicro,
        orgId: input.channel === "B2B" ? input.orgId : null,
        courseId: input.courseId,
        buyerRef: input.channel === "B2C" ? input.buyerRef : null,
        note: input.note,
        createdById: actorId,
        shares: { create: split.shares },
      },
    });

    // Организация заплатила — значит, она уже не пилот.
    if (income.orgId) {
      await tx.organization.update({
        where: { id: income.orgId },
        data: { billing: "PAID" },
      });
    }

    await writeAdminLog({
      actorId,
      action: "finance.income.create",
      meta: {
        incomeId: income.id,
        ...(income.orgId ? { orgId: income.orgId } : {}),
        grossTiyn: income.grossTiyn,
        currency: income.currency,
      },
      tx,
    });
    return income;
  });
}

/**
 * Правка записанного поступления: забыли заметку, ошиблись суммой или датой.
 *
 * Что пересчитывается: раскладка по получателям — она производная от суммы и
 * налога, хранить её расходящейся с ними нельзя. Что НЕ меняется: ставка налога
 * и курс валют остаются теми, что были при записи (D-018: прошлое задним числом
 * не переписывается). Исключение — смена страны или валюты: старая ставка и
 * старый курс к ним просто не относятся, поэтому берутся текущие.
 */
export async function updateIncome(
  id: string,
  input: CreateIncomeInput,
  actorId: string,
) {
  const current = await db.income.findUnique({ where: { id } });
  if (!current) throw new Error("Поступление не найдено");

  const countryChanged = current.country !== input.country;

  const [rate, coOwners, author] = await Promise.all([
    countryChanged
      ? db.taxRate.findUnique({ where: { country: input.country } })
      : Promise.resolve({ country: current.country, rateMilli: current.rateMilli }),
    db.payee.findMany({ where: { role: "CO_OWNER", isActive: true } }),
    db.payee.findUnique({ where: { id: input.authorId } }),
  ]);
  if (!rate) throw new Error(`Не задана ставка налогов для страны ${input.country}`);
  if (!author || author.role !== "AUTHOR" || !author.isActive) {
    throw new Error("Выберите автора курса");
  }

  const fx = needsFreshFx(current, input.currency)
    ? await currentFx(input.currency)
    : { kztPerUnitMicro: current.kztPerUnitMicro, kztPerBynMicro: current.kztPerBynMicro };

  const split = splitIncome({
    grossTiyn: input.grossTiyn,
    rateMilli: rate.rateMilli,
    currency: input.currency,
    coOwners,
    author,
    taxTiyn: input.taxTiyn,
  });

  return db.$transaction(async (tx) => {
    // Доли пересобираем целиком: получатель мог смениться, и остаток автора
    // всегда считается заново от новой чистой прибыли.
    await tx.incomeShare.deleteMany({ where: { incomeId: id } });
    const income = await tx.income.update({
      where: { id },
      data: {
        receivedAt: input.receivedAt,
        channel: input.channel,
        country: input.country,
        currency: input.currency,
        grossTiyn: input.grossTiyn,
        rateMilli: rate.rateMilli,
        taxTiyn: split.taxTiyn,
        netTiyn: split.netTiyn,
        kztPerUnitMicro: fx.kztPerUnitMicro,
        kztPerBynMicro: fx.kztPerBynMicro,
        orgId: input.channel === "B2B" ? input.orgId : null,
        courseId: input.courseId,
        buyerRef: input.channel === "B2C" ? input.buyerRef : null,
        note: input.note,
        shares: { create: split.shares },
      },
    });

    if (income.orgId) {
      await tx.organization.update({
        where: { id: income.orgId },
        data: { billing: "PAID" },
      });
    }

    await writeAdminLog({
      actorId,
      action: "finance.income.update",
      meta: {
        incomeId: income.id,
        ...(income.orgId ? { orgId: income.orgId } : {}),
        grossTiyn: income.grossTiyn,
        currency: income.currency,
      },
      tx,
    });
    return income;
  });
}

export async function deleteIncome(id: string, actorId: string) {
  await db.$transaction(async (tx) => {
    const income = await tx.income.delete({ where: { id } });
    await writeAdminLog({
      actorId,
      action: "finance.income.delete",
      meta: {
        incomeId: id,
        ...(income.orgId ? { orgId: income.orgId } : {}),
        grossTiyn: income.grossTiyn,
        currency: income.currency,
      },
      tx,
    });
  });
}

export type { IncomeFilters } from "./filters";

/** Поступления по отбору; пустой отбор — всё время. */
export async function getIncomes(filters: IncomeFilters = {}) {
  return db.income.findMany({
    where: incomeWhere(filters),
    orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
    include: {
      org: { select: { id: true, name: true } },
      course: { select: { title: true } },
      shares: { include: { payee: { select: { id: true, label: true, role: true } } } },
    },
  });
}

export type IncomeRow = Awaited<ReturnType<typeof getIncomes>>[number];

/**
 * Покупатели, по которым есть поступления, — для фильтра. Берём именно из
 * журнала, а не список всех организаций: фильтровать по клиенту, который ни
 * разу не платил, незачем, а список короче и полезнее.
 */
export async function getIncomeBuyers(): Promise<{
  orgs: { id: string; name: string }[];
  hasRetail: boolean;
}> {
  const [rows, retail] = await Promise.all([
    db.income.findMany({
      where: { orgId: { not: null } },
      distinct: ["orgId"],
      select: { org: { select: { id: true, name: true } } },
      orderBy: { receivedAt: "desc" },
    }),
    db.income.count({ where: { channel: "B2C" } }),
  ]);
  const orgs = rows
    .map((r) => r.org)
    .filter((o): o is { id: string; name: string } => o !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  return { orgs, hasRetail: retail > 0 };
}

/** Годы, за которые есть поступления, — для переключателя периода. */
export async function getIncomeYears(): Promise<number[]> {
  const rows = await db.$queryRaw<{ y: number }[]>`
    SELECT DISTINCT EXTRACT(YEAR FROM "receivedAt")::int AS y FROM "Income" ORDER BY y DESC`;
  return rows.map((r) => r.y);
}

export interface PayeeTotals {
  gross: number;
  net: number;
}

function addPayee(
  map: Map<string, PayeeTotals>,
  label: string,
  share: number,
  row: { netTiyn: number; grossTiyn: number },
) {
  const t = map.get(label) ?? { gross: 0, net: 0 };
  t.gross += payeeGross(share, row.netTiyn, row.grossTiyn);
  t.net += share;
  map.set(label, t);
}

export interface CurrencyTotals {
  currency: string;
  count: number;
  gross: number;
  tax: number;
  net: number;
  /** label → доход (доля выручки до налогов) и чистая прибыль (получено на руки). */
  byPayee: Map<string, PayeeTotals>;
  byChannel: Record<"B2B" | "B2C", { count: number; gross: number }>;
}

/**
 * Итоги по каждой валюте отдельно: тенге и рубли не складываем — курс на дату
 * поступления мы не храним, а пересчёт по сегодняшнему исказил бы прошлое.
 */
export function totalsByCurrency(rows: IncomeRow[]): CurrencyTotals[] {
  const map = new Map<string, CurrencyTotals>();
  for (const r of rows) {
    let t = map.get(r.currency);
    if (!t) {
      t = {
        currency: r.currency,
        count: 0,
        gross: 0,
        tax: 0,
        net: 0,
        byPayee: new Map(),
        byChannel: { B2B: { count: 0, gross: 0 }, B2C: { count: 0, gross: 0 } },
      };
      map.set(r.currency, t);
    }
    t.count += 1;
    t.gross += r.grossTiyn;
    t.tax += r.taxTiyn;
    t.net += r.netTiyn;
    t.byChannel[r.channel].count += 1;
    t.byChannel[r.channel].gross += r.grossTiyn;
    for (const s of r.shares) addPayee(t.byPayee, s.payee.label, s.amountTiyn, r);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export interface MonthRow {
  month: string; // 2026-09
  currency: string;
  count: number;
  gross: number;
  tax: number;
  net: number;
  byPayee: Map<string, PayeeTotals>;
}

export function totalsByMonth(rows: IncomeRow[]): MonthRow[] {
  const map = new Map<string, MonthRow>();
  for (const r of rows) {
    const month = r.receivedAt.toISOString().slice(0, 7);
    const key = `${month}|${r.currency}`;
    let m = map.get(key);
    if (!m) {
      m = { month, currency: r.currency, count: 0, gross: 0, tax: 0, net: 0, byPayee: new Map() };
      map.set(key, m);
    }
    m.count += 1;
    m.gross += r.grossTiyn;
    m.tax += r.taxTiyn;
    m.net += r.netTiyn;
    for (const s of r.shares) addPayee(m.byPayee, s.payee.label, s.amountTiyn, r);
  }
  return [...map.values()].sort((a, b) =>
    a.month === b.month ? a.currency.localeCompare(b.currency) : b.month.localeCompare(a.month),
  );
}

export async function getOrgBillingCounts() {
  const grouped = await db.organization.groupBy({
    by: ["billing"],
    where: { status: { not: "ARCHIVED" } },
    _count: { _all: true },
  });
  const get = (b: "PAID" | "PILOT") => grouped.find((g) => g.billing === b)?._count._all ?? 0;
  return { paid: get("PAID"), pilot: get("PILOT") };
}
