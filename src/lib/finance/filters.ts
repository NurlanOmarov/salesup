import type { Prisma } from "@prisma/client";

/**
 * Отбор строк журнала. Год и произвольный период — одна и та же ось времени:
 * задан период — он и главный, иначе работает год (в интерфейсе выбор периода
 * сбрасывает год и наоборот, чтобы не было двух правд о том, что показано).
 */
export interface IncomeFilters {
  year?: number | null;
  /** YYYY-MM-DD, включительно. */
  from?: string | null;
  to?: string | null;
  country?: string | null;
  /** Конкретная организация-покупатель. */
  orgId?: string | null;
  channel?: "B2B" | "B2C" | null;
  /** Поиск по названию компании, пометке покупателя и заметке. */
  q?: string | null;
}

export function incomeWhere(f: IncomeFilters): Prisma.IncomeWhereInput {
  const where: Prisma.IncomeWhereInput = {};

  if (f.from || f.to) {
    where.receivedAt = {
      ...(f.from ? { gte: new Date(`${f.from}T00:00:00Z`) } : {}),
      ...(f.to ? { lte: new Date(`${f.to}T00:00:00Z`) } : {}),
    };
  } else if (f.year) {
    where.receivedAt = {
      gte: new Date(Date.UTC(f.year, 0, 1)),
      lt: new Date(Date.UTC(f.year + 1, 0, 1)),
    };
  }

  if (f.country) where.country = f.country;
  if (f.orgId) where.orgId = f.orgId;
  if (f.channel) where.channel = f.channel;

  const q = f.q?.trim();
  if (q) {
    // Компанию ищем по названию, розничного покупателя — по пометке; заметка
    // здесь же, потому что в неё пишут номер счёта, а искать его хочется тем же
    // полем, а не третьим.
    where.OR = [
      { org: { name: { contains: q, mode: "insensitive" } } },
      { org: { slug: { contains: q, mode: "insensitive" } } },
      { buyerRef: { contains: q, mode: "insensitive" } },
      { note: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}
