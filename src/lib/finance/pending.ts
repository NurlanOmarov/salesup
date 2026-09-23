import { db } from "@/lib/db";
import { loadRates } from "./rates";
import {
  buildIncomeSuggestion,
  type IncomeSuggestion,
  type SuggestLicense,
} from "./suggest";

/**
 * Организации, по которым оплата не внесена в учёт: клиент отмечен платным
 * (Organization.billing = PAID), а поступления по нему нет ни одного. Такое
 * получается всегда, когда доступы выдали раньше денег, — и без напоминания
 * выручка клиента в /admin/finance просто отсутствует.
 *
 * Считаем «оплата не внесена» по полному отсутствию записей: доплаты и продления
 * отслеживать пока нечем — Income не привязан к конкретной лицензии.
 */

const LICENSE_SELECT = {
  courseId: true,
  seatsTotal: true,
  priceTiyn: true,
  note: true,
  course: { select: { priceTiyn: true } },
} as const;

type LicenseRow = {
  courseId: string;
  seatsTotal: number;
  priceTiyn: number | null;
  note: string | null;
  course: { priceTiyn: number };
};

function toSuggestLicenses(rows: LicenseRow[]): SuggestLicense[] {
  return rows.map((l) => ({
    courseId: l.courseId,
    seatsTotal: l.seatsTotal,
    priceTiyn: l.priceTiyn,
    coursePriceTiyn: l.course.priceTiyn,
    note: l.note,
  }));
}

export interface OrgAwaitingIncome {
  id: string;
  name: string;
  slug: string;
  site: string | null;
  createdAt: Date;
  suggestion: IncomeSuggestion;
}

export async function getOrgsAwaitingIncome(): Promise<OrgAwaitingIncome[]> {
  const orgs = await db.organization.findMany({
    where: {
      billing: "PAID",
      status: { not: "ARCHIVED" },
      incomes: { none: {} },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      site: true,
      createdAt: true,
      licenses: { select: LICENSE_SELECT },
    },
  });
  if (orgs.length === 0) return [];

  const rates = await loadRates();
  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    site: o.site,
    createdAt: o.createdAt,
    suggestion: buildIncomeSuggestion({
      site: o.site,
      licenses: toSuggestLicenses(o.licenses),
      rates,
    }),
  }));
}

/** Предзаполнение формы поступления по одной организации (визард из карточки). */
export async function getIncomeSuggestion(
  orgId: string,
): Promise<IncomeSuggestion | null> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      site: true,
      licenses: { select: LICENSE_SELECT },
      _count: { select: { incomes: true } },
    },
  });
  if (!org) return null;

  const rates = await loadRates();
  return buildIncomeSuggestion({
    site: org.site,
    licenses: toSuggestLicenses(org.licenses),
    rates,
    existingIncomes: org._count.incomes,
  });
}

/** Сколько клиентов ждут записи оплаты — для счётчиков на страницах. */
export async function countOrgsAwaitingIncome(): Promise<number> {
  return db.organization.count({
    where: {
      billing: "PAID",
      status: { not: "ARCHIVED" },
      incomes: { none: {} },
    },
  });
}
