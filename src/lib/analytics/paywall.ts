import "server-only";
import { db } from "@/lib/db";

/**
 * Упор в демо-пейволл: ученик открыл урок за границей демо-доступа
 * (Enrollment/OrgLicense.demoPercent). Источник истины — своя таблица Event
 * (CLAUDE.md D-002); это список на обзвон: кто дошёл до стены, тому есть что
 * продавать. ПДн не пишем — только userId, курс, урок и процент демо.
 */
export const PAYWALL_VIEW = "paywall.view";

export async function recordPaywallView(input: {
  userId: string;
  courseId: string;
  courseSlug: string;
  lessonId: string;
  percent: number;
  orgId?: string | null;
}): Promise<void> {
  try {
    await db.event.create({
      data: {
        userId: input.userId,
        name: PAYWALL_VIEW,
        meta: {
          courseId: input.courseId,
          slug: input.courseSlug,
          lessonId: input.lessonId,
          percent: input.percent,
          ...(input.orgId ? { orgId: input.orgId } : {}),
        },
      },
    });
  } catch {
    // Аналитика не должна ронять показ пейволла.
  }
}
