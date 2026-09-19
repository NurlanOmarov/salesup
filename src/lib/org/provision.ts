/**
 * Автосоздание кабинетов работников при выдаче лицензии: чистое планирование
 * без БД (исполняет план `provisionSeats` в lib/org/service.ts).
 *
 * Единица лицензии — курс × человек, а человек — это учётка. Поэтому места новой
 * лицензии в первую очередь отдаются УЖЕ существующим работникам организации,
 * у которых этого курса ещё нет, и только недостающее покрывается новыми
 * учётками. Иначе «библиотека» из 20 курсов на 10 мест превратилась бы в 200
 * учёток вместо десяти, а сотрудник с тремя курсами держал бы три логина.
 */

export interface ProvisionLicense {
  licenseId: string;
  courseId: string;
  /** Сколько мест лицензии заполнить. */
  count: number;
}

export interface ProvisionLearner {
  userId: string;
  /** Курсы, по которым у работника есть запись (в т.ч. отозванная — её не воскрешаем). */
  courseIds: ReadonlySet<string>;
}

export interface ProvisionPlan {
  /** Существующим работникам — какие лицензии им открыть. */
  reuse: { userId: string; licenseIds: string[] }[];
  /** Новые учётки — какие лицензии открыть каждой. */
  fresh: { licenseIds: string[] }[];
}

interface Slot {
  userId: string | null;
  courses: Set<string>;
  licenseIds: string[];
}

export function planProvision(
  learners: readonly ProvisionLearner[],
  licenses: readonly ProvisionLicense[],
): ProvisionPlan {
  const existing: Slot[] = learners.map((l) => ({
    userId: l.userId,
    courses: new Set(l.courseIds),
    licenseIds: [],
  }));
  const fresh: Slot[] = [];

  for (const license of licenses) {
    let left = Math.max(0, Math.floor(license.count));
    // Сначала уже существующие (и уже запланированные новые) без этого курса.
    for (const slot of [...existing, ...fresh]) {
      if (left === 0) break;
      if (slot.courses.has(license.courseId)) continue;
      slot.courses.add(license.courseId);
      slot.licenseIds.push(license.licenseId);
      left -= 1;
    }
    // Остаток — новые учётки.
    while (left > 0) {
      fresh.push({
        userId: null,
        courses: new Set([license.courseId]),
        licenseIds: [license.licenseId],
      });
      left -= 1;
    }
  }

  return {
    reuse: existing
      .filter((s) => s.licenseIds.length > 0)
      .map((s) => ({ userId: s.userId!, licenseIds: s.licenseIds })),
    fresh: fresh.map((s) => ({ licenseIds: s.licenseIds })),
  };
}

/**
 * Сколько мест заполнить при выдаче лицензии. Новая лицензия — все места; при
 * расширении существующей — только прирост: иначе повторное сохранение лицензии
 * (смена цены, срока) воскрешало бы места, которые ответственный намеренно
 * освободил, уволив сотрудника.
 */
export function seatsToProvision(input: {
  previousSeatsTotal: number | null;
  seatsTotal: number;
}): number {
  if (input.previousSeatsTotal === null) return Math.max(0, input.seatsTotal);
  return Math.max(0, input.seatsTotal - input.previousSeatsTotal);
}
