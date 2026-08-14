import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { computeSeatExpiry } from "@/lib/org/seats";

/**
 * Приведение мест организации в соответствие с её состоянием (docs/B2B-PLAN.md).
 *
 * Смысл существования этого модуля: доступ к контенту определяется ТОЛЬКО
 * Enrollment (CLAUDE.md правило 1). Поэтому «организация заморожена», «лицензия
 * истекла», «работник деактивирован» не проверяются в lib/access.ts, а
 * превращаются здесь в обычные revokedAt/expiresAt. Одна ветка проверки доступа,
 * а не две.
 *
 * Запускается задачей org.sync-access при смене статуса/лицензии и ежедневным
 * maintenance.daily (истечение срока лицензии наступает само по себе).
 */

/** Причины автоматического отзыва — их можно восстановить, ручные нельзя. */
export const AUTO_REVOKE_REASONS = ["org_suspended", "member_inactive"] as const;

export interface SyncResult {
  revoked: number;
  restored: number;
  expiryUpdated: number;
}

/** Синхронизировать одну организацию. */
export async function syncOrgAccess(
  orgId: string,
  now: Date = new Date(),
): Promise<SyncResult> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { id: true, status: true },
  });
  if (!org) return { revoked: 0, restored: 0, expiryUpdated: 0 };

  const memberships = await db.orgMembership.findMany({
    where: { orgId },
    select: { userId: true, isActive: true },
  });
  const inactiveUserIds = memberships.filter((m) => !m.isActive).map((m) => m.userId);

  const licenses = await db.orgLicense.findMany({
    where: { orgId },
    select: { id: true, accessDuration: true, expiresAt: true },
  });
  const licenseIds = licenses.map((l) => l.id);
  if (licenseIds.length === 0) return { revoked: 0, restored: 0, expiryUpdated: 0 };

  let revoked = 0;
  let restored = 0;
  let expiryUpdated = 0;

  // 1. Организация не активна → снимаем все действующие места.
  if (org.status !== "ACTIVE") {
    const res = await db.enrollment.updateMany({
      where: { licenseId: { in: licenseIds }, revokedAt: null },
      data: { revokedAt: now, revokedReason: "org_suspended" },
    });
    revoked += res.count;
    return { revoked, restored, expiryUpdated };
  }

  // 2. Организация активна → возвращаем места, снятые заморозкой (но не вручную).
  const restorable = await db.enrollment.findMany({
    where: {
      licenseId: { in: licenseIds },
      revokedAt: { not: null },
      revokedReason: "org_suspended",
      userId: { notIn: inactiveUserIds.length ? inactiveUserIds : ["-"] },
    },
    select: { id: true, licenseId: true, startsAt: true },
  });

  for (const e of restorable) {
    const license = licenses.find((l) => l.id === e.licenseId);
    if (!license) continue;
    await db.enrollment.update({
      where: { id: e.id },
      data: {
        revokedAt: null,
        revokedReason: null,
        expiresAt: computeSeatExpiry({
          accessDuration: license.accessDuration,
          licenseExpiresAt: license.expiresAt,
          from: e.startsAt,
        }),
      },
    });
    restored += 1;
  }

  // 3. Деактивированные работники теряют места (места возвращаются в пул).
  if (inactiveUserIds.length > 0) {
    const res = await db.enrollment.updateMany({
      where: {
        licenseId: { in: licenseIds },
        revokedAt: null,
        userId: { in: inactiveUserIds },
      },
      data: { revokedAt: now, revokedReason: "member_inactive" },
    });
    revoked += res.count;
  }

  // 4. Срок лицензии мог измениться (продлили/сократили) — подтягиваем места.
  for (const license of licenses) {
    const seats = await db.enrollment.findMany({
      where: { licenseId: license.id, revokedAt: null },
      select: { id: true, startsAt: true, expiresAt: true },
    });
    for (const seat of seats) {
      const target = computeSeatExpiry({
        accessDuration: license.accessDuration,
        licenseExpiresAt: license.expiresAt,
        from: seat.startsAt,
      });
      const same =
        (target === null && seat.expiresAt === null) ||
        (target !== null &&
          seat.expiresAt !== null &&
          target.getTime() === seat.expiresAt.getTime());
      if (same) continue;
      await db.enrollment.update({
        where: { id: seat.id },
        data: { expiresAt: target },
      });
      expiryUpdated += 1;
    }
  }

  return { revoked, restored, expiryUpdated };
}

/** Синхронизировать все организации — ежедневное обслуживание. */
export async function syncAllOrgAccess(now: Date = new Date()): Promise<SyncResult> {
  const orgs = await db.organization.findMany({ select: { id: true } });
  const total: SyncResult = { revoked: 0, restored: 0, expiryUpdated: 0 };
  for (const org of orgs) {
    const r = await syncOrgAccess(org.id, now);
    total.revoked += r.revoked;
    total.restored += r.restored;
    total.expiryUpdated += r.expiryUpdated;
  }
  if (total.revoked || total.restored || total.expiryUpdated) {
    log.info(total, "org.sync-access: доступы приведены в соответствие");
  }
  return total;
}
