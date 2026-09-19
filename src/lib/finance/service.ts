import { db } from "@/lib/db";
import { writeAdminLog } from "@/lib/admin/log";
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
  const [rate, coOwners, author] = await Promise.all([
    db.taxRate.findUnique({ where: { country: input.country } }),
    db.payee.findMany({ where: { role: "CO_OWNER", isActive: true } }),
    db.payee.findUnique({ where: { id: input.authorId } }),
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

/** Поступления за период: год или всё время (year = null). */
export async function getIncomes(year: number | null) {
  return db.income.findMany({
    where: year
      ? { receivedAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } }
      : undefined,
    orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
    include: {
      org: { select: { id: true, name: true } },
      course: { select: { title: true } },
      shares: { include: { payee: { select: { label: true } } } },
    },
  });
}

export type IncomeRow = Awaited<ReturnType<typeof getIncomes>>[number];

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
