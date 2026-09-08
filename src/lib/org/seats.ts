import type { AccessDuration } from "@prisma/client";
import { computeExpiry } from "@/lib/admin/enrollment";

/**
 * Учёт мест в корпоративной лицензии (docs/B2B-PLAN.md, оферта /offer-b2b).
 * Единица лицензии — курс × человек: одна лицензия = один курс × N мест.
 *
 * Чистые функции без БД: считают занятость, срок доступа места и генерируют
 * логины/коды. Всё, что тут есть, юнит-тестируется (seats.test.ts).
 */

export interface SeatUsage {
  total: number;
  used: number;
  free: number;
  /** Доля занятых мест 0..1 — «утилизация», главный аргумент при продлении. */
  utilization: number;
}

/**
 * Занятость лицензии. Занятым считается место с непогашенным Enrollment:
 * отозванные (revokedAt) освобождаются и могут быть переданы другому работнику
 * (оферта, п. 4.4). Истёкшие места остаются занятыми до конца срока лицензии —
 * иначе клиент, у которого срок вышел, «получил бы» свободные места даром.
 */
export function computeSeatUsage(input: {
  seatsTotal: number;
  activeEnrollments: number;
}): SeatUsage {
  const total = Math.max(0, input.seatsTotal);
  const used = Math.max(0, input.activeEnrollments);
  const free = Math.max(0, total - used);
  return {
    total,
    used,
    free,
    utilization: total === 0 ? 0 : Math.min(1, used / total),
  };
}

/** Есть ли куда посадить ещё одного работника. */
export function hasFreeSeat(usage: SeatUsage): boolean {
  return usage.free > 0;
}

/**
 * Дата окончания доступа для места. Берётся минимум из срока места
 * (accessDuration от даты выдачи) и общего дедлайна лицензии: доступ работника
 * не может пережить саму лицензию (оферта, п. 4.5).
 */
export function computeSeatExpiry(input: {
  accessDuration: AccessDuration;
  licenseExpiresAt: Date | null;
  from: Date;
}): Date | null {
  const bySeat = computeExpiry(input.accessDuration, input.from);
  const byLicense = input.licenseExpiresAt;

  if (!bySeat) return byLicense; // LIFETIME место, но лицензия может быть срочной
  if (!byLicense) return bySeat;
  return bySeat.getTime() < byLicense.getTime() ? bySeat : byLicense;
}

/**
 * Логин работника: `<slug>-<номер>` с ведущими нулями до 4 знаков.
 * Номер берётся из Organization.loginSeq и инкрементируется в транзакции —
 * это и есть защита от коллизий при одновременной активации кодов.
 */
export function formatLogin(orgSlug: string, seq: number): string {
  return `${orgSlug}-${String(seq).padStart(4, "0")}`;
}

/**
 * Slug организации из названия: латиница/цифры/дефис. Кириллица транслитерируется —
 * логин работника должен набираться с любой раскладки.
 */
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function slugifyOrgName(name: string): string {
  const lower = name.trim().toLowerCase();
  let out = "";
  for (const ch of lower) {
    if (ch in TRANSLIT) out += TRANSLIT[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else out += "-";
  }
  return out.replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
}
