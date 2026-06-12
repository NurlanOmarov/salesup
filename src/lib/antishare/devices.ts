import { db } from "@/lib/db";
import { deviceFingerprint, DEVICE_LIMIT, evaluateFlags, type FlagReason } from "./heuristics.js";

/**
 * Учёт устройств и выявление подозрительной активности (S6.1). Вход жёстко не
 * блокируем (JWT stateless) — фиксируем устройства при логине и считаем сигналы
 * для владельца (/admin/flags). Немедленный отзыв доступа — Enrollment.revokedAt;
 * мягкая блокировка входа — User.deletedAt (toggleBlock в админке).
 */

const ACTIVE_WINDOW_DAYS = 7;

/** Зарегистрировать устройство при входе (upsert по userId+fingerprint). */
export async function registerDevice(
  userId: string,
  userAgent: string,
  ip: string,
): Promise<void> {
  const fingerprint = deviceFingerprint(userAgent || "unknown");
  await db.device.upsert({
    where: { userId_fingerprint: { userId, fingerprint } },
    create: { userId, fingerprint, lastIp: ip, lastSeenAt: new Date() },
    update: { lastIp: ip, lastSeenAt: new Date() },
  });
}

export interface FlaggedStudent {
  userId: string;
  name: string | null;
  email: string;
  activeDevices: number;
  distinctIps: number;
  reasons: FlagReason[];
  blocked: boolean;
}

/**
 * Подозрительные ученики для /admin/flags: превышен лимит устройств, много IP,
 * аномальный объём просмотра. Считаем на лету за окно активности.
 */
export async function getFlaggedStudents(): Promise<FlaggedStudent[]> {
  const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Устройства за окно, сгруппированные по ученику.
  const devices = await db.device.findMany({
    where: { lastSeenAt: { gte: since } },
    select: { userId: true, lastIp: true },
  });
  const byUser = new Map<string, { count: number; ips: Set<string> }>();
  for (const d of devices) {
    const e = byUser.get(d.userId) ?? { count: 0, ips: new Set<string>() };
    e.count += 1;
    if (d.lastIp) e.ips.add(d.lastIp);
    byUser.set(d.userId, e);
  }

  // Аномальный просмотр: watchedSec заметно больше длительности урока.
  const heavyProgress = await db.lessonProgress.findMany({
    where: { watchedSec: { gt: 0 }, lesson: { durationSec: { not: null } } },
    select: { userId: true, watchedSec: true, lesson: { select: { durationSec: true } } },
  });
  const abnormalWatch = new Map<string, { watched: number; duration: number }>();
  for (const p of heavyProgress) {
    const dur = p.lesson.durationSec ?? 0;
    const cur = abnormalWatch.get(p.userId);
    if (!cur || p.watchedSec / Math.max(1, dur) > cur.watched / Math.max(1, cur.duration)) {
      abnormalWatch.set(p.userId, { watched: p.watchedSec, duration: dur });
    }
  }

  const candidateIds = new Set([...byUser.keys(), ...abnormalWatch.keys()]);
  if (candidateIds.size === 0) return [];

  const users = await db.user.findMany({
    where: { id: { in: [...candidateIds] }, role: "STUDENT" },
    select: { id: true, name: true, email: true, deletedAt: true },
  });

  const result: FlaggedStudent[] = [];
  for (const u of users) {
    const dev = byUser.get(u.id) ?? { count: 0, ips: new Set<string>() };
    const watch = abnormalWatch.get(u.id) ?? { watched: 0, duration: 0 };
    const reasons = evaluateFlags({
      activeDevices: dev.count,
      maxWatchedSec: watch.watched,
      maxLessonDurationSec: watch.duration,
      distinctCities: dev.ips.size, // в MVP город ≈ IP (геолокации нет)
    });
    if (reasons.length === 0) continue;
    result.push({
      userId: u.id,
      name: u.name,
      email: u.email,
      activeDevices: dev.count,
      distinctIps: dev.ips.size,
      reasons,
      blocked: !!u.deletedAt,
    });
  }

  // Сначала самые подозрительные (больше причин / устройств).
  return result.sort((a, b) => b.reasons.length - a.reasons.length || b.activeDevices - a.activeDevices);
}

export { DEVICE_LIMIT };
