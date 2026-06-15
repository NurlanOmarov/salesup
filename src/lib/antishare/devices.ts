import { db } from "@/lib/db";
import {
  deviceFingerprint,
  DEVICE_LIMIT,
  effectiveDeviceLimit,
  evaluateFlags,
  type FlagReason,
} from "./heuristics.js";

/**
 * Учёт устройств и выявление подозрительной активности (S6.1). Вход жёстко не
 * блокируем (JWT stateless) — фиксируем устройства при логине и считаем сигналы
 * для владельца (/admin/flags). Немедленный отзыв доступа — Enrollment.revokedAt;
 * мягкая блокировка входа — User.deletedAt (toggleBlock в админке).
 */

const ACTIVE_WINDOW_DAYS = 7;

/**
 * Зарегистрировать устройство при входе и проверить лимит устройств ученика.
 * Возвращает { allowed }: false — если это НОВОЕ устройство сверх персонального
 * лимита (User.deviceLimit) или ранее заблокированное. Владелец и «безлимит»
 * (deviceLimit=0) не ограничиваются. Известное устройство всегда проходит.
 */
export async function registerDevice(
  userId: string,
  userAgent: string,
  ip: string,
): Promise<{ allowed: boolean }> {
  const fingerprint = deviceFingerprint(userAgent || "unknown");
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, deviceLimit: true },
  });
  const limit = user?.role === "OWNER" ? null : effectiveDeviceLimit(user?.deviceLimit ?? null);

  const existing = await db.device.findUnique({
    where: { userId_fingerprint: { userId, fingerprint } },
    select: { isBlocked: true },
  });

  // Новое устройство сверх лимита — фиксируем как заблокированное и не пускаем.
  if (!existing && limit !== null) {
    const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const active = await db.device.count({
      where: { userId, isBlocked: false, lastSeenAt: { gte: since } },
    });
    if (active >= limit) {
      await db.device.create({
        data: { userId, fingerprint, lastIp: ip, isBlocked: true, label: "Сверх лимита" },
      });
      return { allowed: false };
    }
  }
  if (existing?.isBlocked) return { allowed: false };

  await db.device.upsert({
    where: { userId_fingerprint: { userId, fingerprint } },
    create: { userId, fingerprint, lastIp: ip, lastSeenAt: new Date() },
    update: { lastIp: ip, lastSeenAt: new Date() },
  });
  return { allowed: true };
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
    select: { id: true, name: true, email: true, deletedAt: true, deviceLimit: true },
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
      deviceLimit: effectiveDeviceLimit(u.deviceLimit), // персональный лимит ученика
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
