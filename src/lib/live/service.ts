import "server-only";
import { randomUUID } from "node:crypto";
import type { LiveSessionKind, LiveSessionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { overlaps } from "./format";
import * as sabak from "./sabak";

/**
 * Живые сессии с тренером: расписание, доступ и результат встречи
 * (docs/LIVE-SESSIONS-PLAN.md).
 *
 * Разделение обязанностей: `sabak.ts` знает про HTTP, этот модуль — про нашу
 * предметную область (организация, права, статусы). Правило, которое держит всю
 * конструкцию: **встреча существует в нашей БД независимо от SABAK**. Если
 * видеосервис недоступен в момент планирования, запись всё равно создаётся, а
 * `sabakLessonId` остаётся пустым — владелец видит это в консоли и повторяет
 * одной кнопкой. Иначе сбой чужого сервиса стирал бы договорённость с клиентом.
 */

/** Вводная идёт вебинаром (аудитория слушает), итоговая — разговором. */
function sabakKind(kind: LiveSessionKind): "WEBINAR" | "MEETING" {
  return kind === "INTRO" ? "WEBINAR" : "MEETING";
}

export interface PlanSessionInput {
  orgId: string;
  kind: LiveSessionKind;
  title: string;
  /** Момент начала в UTC. */
  scheduledAt: Date;
  /** IANA-зона компании: Europe/Minsk, Asia/Almaty, Asia/Tashkent, Europe/Moscow. */
  timezone: string;
  durationMin: number;
  courseId?: string | null;
  note?: string | null;
}

/**
 * Планирование встречи. Сначала пишем к себе, потом просим SABAK — порядок
 * важен: у нас должен остаться след даже при отвалившемся видеосервисе.
 */
export async function planSession(input: PlanSessionInput) {
  const session = await db.liveSession.create({
    data: {
      orgId: input.orgId,
      kind: input.kind,
      title: input.title,
      scheduledAt: input.scheduledAt,
      timezone: input.timezone,
      durationMin: input.durationMin,
      courseId: input.courseId ?? null,
      note: input.note ?? null,
      // Ключ рождается вместе со встречей и живёт с ней: сколько бы раз мы ни
      // повторяли создание в SABAK, там появится ровно один урок.
      idempotencyKey: randomUUID(),
    },
  });

  await ensureRemote(session.id);
  return db.liveSession.findUniqueOrThrow({ where: { id: session.id } });
}

/**
 * Создаёт встречу в SABAK, если её там ещё нет. Безопасно вызывать повторно —
 * на том конце стоит ключ идемпотентности.
 */
export async function ensureRemote(sessionId: string): Promise<boolean> {
  const session = await db.liveSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { org: { select: { name: true } } },
  });
  if (session.sabakLessonId) return true;
  if (session.status === "CANCELLED") return false;
  if (!sabak.liveEnabled()) return false;

  try {
    const remote = await sabak.createSession({
      title: session.title,
      scheduledAt: session.scheduledAt,
      durationMin: session.durationMin,
      kind: sabakKind(session.kind),
      groupName: `${session.org.name} — отдел продаж`,
      idempotencyKey: session.idempotencyKey,
    });
    await db.liveSession.update({
      where: { id: session.id },
      data: { sabakLessonId: remote.id, joinUrl: remote.guestUrl },
    });
    return true;
  } catch (e) {
    // Не роняем страницу: владелец увидит «не создана» и нажмёт «Повторить».
    log.error({ err: e, sessionId }, "live.ensureRemote: SABAK недоступен");
    return false;
  }
}

export async function reschedule(
  sessionId: string,
  scheduledAt: Date,
  durationMin: number,
) {
  const session = await db.liveSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.sabakLessonId && sabak.liveEnabled()) {
    await sabak.rescheduleSession(session.sabakLessonId, scheduledAt, durationMin);
  }
  return db.liveSession.update({
    where: { id: sessionId },
    data: { scheduledAt, durationMin },
  });
}

export async function cancelSession(sessionId: string) {
  const session = await db.liveSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.sabakLessonId && sabak.liveEnabled()) {
    try {
      await sabak.cancelSession(session.sabakLessonId);
    } catch (e) {
      // Отмену у себя доводим до конца в любом случае: клиенту сказали «не будет»,
      // и встреча не должна остаться видимой в кабинете из-за чужой ошибки.
      log.warn({ err: e, sessionId }, "live.cancel: SABAK не принял отмену");
    }
  }
  return db.liveSession.update({
    where: { id: sessionId },
    data: { status: "CANCELLED" },
  });
}

/**
 * Подтягивает результат прошедшей встречи: посещаемость («был / не был») и
 * готовность записи. Вызывается после `FINISHED` — из фоновой задачи или руками
 * из консоли владельца.
 */
export async function syncResult(sessionId: string): Promise<void> {
  const session = await db.liveSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (!session.sabakLessonId || !sabak.liveEnabled()) return;

  try {
    const summary = await sabak.attendanceSummary(session.sabakLessonId);
    // Храним только факт присутствия: минуты, которые вернул SABAK, дальше этой
    // строки не идут — решение владельца, и заодно меньше данных о работнике.
    await db.$transaction([
      ...summary.participants.map((p) =>
        db.liveSessionAttendance.upsert({
          where: {
            sessionId_memberLogin: { sessionId, memberLogin: p.externalId },
          },
          create: { sessionId, memberLogin: p.externalId, attended: p.attended },
          update: { attended: p.attended },
        }),
      ),
      db.liveSession.update({
        where: { id: sessionId },
        data: {
          status: "FINISHED",
          attendedCount: summary.participants.filter((p) => p.attended).length,
        },
      }),
    ]);
  } catch (e) {
    log.warn({ err: e, sessionId }, "live.syncResult: посещаемость не получена");
  }

  try {
    const recordings = await sabak.listRecordings(session.sabakLessonId);
    const ready = recordings.find((r) => r.ready);
    if (ready) {
      await db.liveSession.update({
        where: { id: sessionId },
        data: { recordingId: ready.id, recordingReady: true },
      });
    }
  } catch (e) {
    log.warn({ err: e, sessionId }, "live.syncResult: запись не получена");
  }
}

/**
 * Ссылка на вход для конкретного работника.
 *
 * Единственная точка, где выдаётся доступ к встрече, и здесь же — проверка прав:
 * членство в организации смотрим в БД при каждом вызове (как в lib/org/guards),
 * а не по тому, что пришло из формы.
 */
export async function joinUrlFor(
  userId: string,
  sessionId: string,
): Promise<string | null> {
  const session = await db.liveSession.findUnique({
    where: { id: sessionId },
    select: { id: true, orgId: true, status: true, sabakLessonId: true, joinUrl: true },
  });
  if (!session || session.status === "CANCELLED") return null;

  const membership = await db.orgMembership.findFirst({
    where: { userId, orgId: session.orgId, isActive: true },
    select: { user: { select: { login: true } } },
  });
  const login = membership?.user.login;
  if (!login) return null;

  if (!session.sabakLessonId || !sabak.liveEnabled()) return session.joinUrl;

  try {
    const access = await sabak.guestAccess(session.sabakLessonId, login);
    return access.joinUrl;
  } catch (e) {
    // Персональная ссылка не вышла — отдаём общую гостевую: человек введёт свой
    // логин в лобби сам. Пустой экран за минуту до встречи хуже лишнего шага.
    log.warn({ err: e, sessionId }, "live.joinUrlFor: гостевой доступ не выдан");
    return session.joinUrl;
  }
}

/**
 * Ссылка на запись для кабинета компании. Живёт час и не даёт скачивания —
 * запись принадлежит только этой компании (docs/LIVE-SESSIONS-PLAN.md §6).
 */
export async function recordingUrlFor(
  userId: string,
  sessionId: string,
): Promise<string | null> {
  const session = await db.liveSession.findUnique({
    where: { id: sessionId },
    select: { orgId: true, recordingId: true, recordingReady: true },
  });
  if (!session?.recordingId || !session.recordingReady) return null;

  const member = await db.orgMembership.findFirst({
    where: { userId, orgId: session.orgId, isActive: true },
    select: { id: true },
  });
  const owner = await db.user.findFirst({
    where: { id: userId, role: "OWNER" },
    select: { id: true },
  });
  if (!member && !owner) return null;

  try {
    const link = await sabak.recordingLink(session.recordingId, 60);
    return link.url;
  } catch (e) {
    log.warn({ err: e, sessionId }, "live.recordingUrlFor: ссылка не выдана");
    return null;
  }
}

/** Встречи организации: ближайшие сверху, прошедшие ниже. */
export async function listForOrg(orgId: string) {
  return db.liveSession.findMany({
    where: { orgId, status: { not: "CANCELLED" } },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      kind: true,
      title: true,
      scheduledAt: true,
      timezone: true,
      durationMin: true,
      status: true,
      joinUrl: true,
      recordingReady: true,
      attendedCount: true,
    },
  });
}

/** Всё расписание тренера — календарь у нас один, он же и ограничитель слотов. */
export async function listAll(statuses?: LiveSessionStatus[]) {
  return db.liveSession.findMany({
    where: statuses ? { status: { in: statuses } } : undefined,
    orderBy: { scheduledAt: "asc" },
    include: { org: { select: { id: true, name: true } } },
  });
}

/**
 * Пересекается ли новая встреча с уже запланированной. Тренер один (решение
 * владельца), поэтому занятый слот — жёсткое ограничение, а не подсказка.
 */
export async function conflictsWith(
  scheduledAt: Date,
  durationMin: number,
  exceptId?: string,
): Promise<{ id: string; title: string; scheduledAt: Date } | null> {
  const start = scheduledAt.getTime();
  const end = start + durationMin * 60_000;
  const near = await db.liveSession.findMany({
    where: {
      status: { in: ["PLANNED", "LIVE"] },
      ...(exceptId ? { id: { not: exceptId } } : {}),
      scheduledAt: {
        gte: new Date(start - 6 * 3600_000),
        lte: new Date(end + 6 * 3600_000),
      },
    },
    select: { id: true, title: true, scheduledAt: true, durationMin: true },
  });

  const hit = near.find((s) =>
    overlaps(scheduledAt, durationMin, s.scheduledAt, s.durationMin),
  );
  return hit ? { id: hit.id, title: hit.title, scheduledAt: hit.scheduledAt } : null;
}
