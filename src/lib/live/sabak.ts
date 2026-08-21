import "server-only";
import { env } from "@/env";
import { log } from "@/lib/log";

/**
 * Клиент SABAK.kz — единственное место, где мы разговариваем с видеосервисом
 * (docs/LIVE-SESSIONS-PLAN.md, docs/SABAK-INTEGRATION-REQUEST.md).
 *
 * Два режима авторизации:
 *   1. Сервисный ключ (`client_credentials`) — целевой; ждём его от команды SABAK.
 *   2. Логин и пароль учётки тренера — временный костыль на период, пока ключей
 *      нет. Живёт в секретах сервера и уходит вместе с первым режимом.
 * Код вызывающей стороны про это не знает: `token()` сам выбирает, что доступно.
 *
 * Правило приватности (правило 9, Закон РБ № 99-З): наружу уходит ТОЛЬКО
 * обезличенный логин работника (`acme-0042`). Ни ФИО, ни e-mail, ни телефон в
 * этот модуль не передаются — в типах для них просто нет полей.
 */

export class LiveDisabledError extends Error {
  constructor() {
    super("Живые сессии выключены: не задан LIVE_SESSIONS_ENABLED или SABAK_BASE_URL");
    this.name = "LiveDisabledError";
  }
}

export class SabakError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SabakError";
  }
}

/** Готова ли интеграция: без этого раздел встреч не показывается вовсе. */
export function liveEnabled(): boolean {
  if (!env.LIVE_SESSIONS_ENABLED || !env.SABAK_BASE_URL) return false;
  const hasKey = !!(env.SABAK_CLIENT_ID && env.SABAK_CLIENT_SECRET);
  const hasPassword = !!(env.SABAK_SERVICE_LOGIN && env.SABAK_SERVICE_PASSWORD);
  return hasKey || hasPassword;
}

// Токен живёт 15–30 минут; держим его в памяти процесса и обновляем заранее.
// Redis для этого не нужен: лишний запрос токена стоит десятки миллисекунд, а
// худший случай — каждый инстанс приложения получает свой.
let cachedToken: { value: string; expiresAt: number } | null = null;

/** Сбрасывает кеш токена — для тестов и после 401. */
export function resetTokenCache(): void {
  cachedToken = null;
}

async function token(): Promise<string> {
  if (!liveEnabled()) throw new LiveDisabledError();
  // 60 секунд запаса: токен, истекающий в полёте запроса, — источник плавающих
  // 401, которые невозможно воспроизвести.
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) {
    return cachedToken.value;
  }

  const base = env.SABAK_BASE_URL!;
  let value: string;
  let ttlSec = 900;

  if (env.SABAK_CLIENT_ID && env.SABAK_CLIENT_SECRET) {
    const res = await fetch(`${base}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: env.SABAK_CLIENT_ID,
        client_secret: env.SABAK_CLIENT_SECRET,
      }),
      cache: "no-store",
    });
    const data = (await safeJson(res)) as { access_token?: string; expires_in?: number };
    if (!res.ok || !data?.access_token) {
      throw new SabakError("SABAK не выдал сервисный токен", res.status);
    }
    value = data.access_token;
    ttlSec = data.expires_in ?? ttlSec;
  } else {
    const res = await fetch(`${base}/auth/local/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        login: env.SABAK_SERVICE_LOGIN,
        password: env.SABAK_SERVICE_PASSWORD,
      }),
      cache: "no-store",
    });
    const data = (await safeJson(res)) as { accessToken?: string };
    if (!res.ok || !data?.accessToken) {
      throw new SabakError("SABAK не пустил учётку тренера", res.status);
    }
    value = data.accessToken;
  }

  cachedToken = { value, expiresAt: Date.now() + ttlSec * 1000 };
  return value;
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Запрос к SABAK с одной повторной попыткой после 401: сервисный токен могли
 * отозвать или он протух раньше срока — перелогиниваемся и пробуем ещё раз.
 * Дальше ошибку отдаём наверх: вызывающий код обязан пережить недоступность
 * SABAK, а не молча показать пустой экран.
 */
async function call<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {},
  retry = true,
): Promise<T> {
  const base = env.SABAK_BASE_URL!;
  const { idempotencyKey, ...rest } = init;
  const res = await fetch(`${base}${path}`, {
    ...rest,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${await token()}`,
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      ...(rest.headers ?? {}),
    },
    cache: "no-store",
    // Встреча начинается по часам: лучше показать ошибку, чем держать страницу.
    signal: AbortSignal.timeout(10_000),
  });

  if (res.status === 401 && retry) {
    resetTokenCache();
    return call<T>(path, init, false);
  }
  if (!res.ok) {
    const body = (await safeJson(res)) as { message?: string } | null;
    throw new SabakError(body?.message ?? `SABAK ответил ${res.status}`, res.status);
  }
  return (await safeJson(res)) as T;
}

// ─────────────────────────────── операции ───────────────────────────────

export interface CreateSessionInput {
  title: string;
  /** Начало в UTC. */
  scheduledAt: Date;
  durationMin: number;
  /** Вводная — вебинар (аудитория слушает), итоговая — встреча (все говорят). */
  kind: "WEBINAR" | "MEETING";
  /** Название группы на стороне SABAK — «<Компания> — отдел продаж». */
  groupName: string;
  /** Ключ идемпотентности: повтор не создаёт вторую встречу в календаре тренера. */
  idempotencyKey: string;
}

export interface SabakSession {
  id: string;
  guestUrl: string;
  status: string;
}

export async function createSession(input: CreateSessionInput): Promise<SabakSession> {
  return call<SabakSession>("/my/lessons", {
    method: "POST",
    idempotencyKey: input.idempotencyKey,
    body: JSON.stringify({
      title: input.title,
      scheduledAt: input.scheduledAt.toISOString(),
      durationMinutes: input.durationMin,
      kind: input.kind,
      allowGuests: true,
      // Анкета гостя выключена намеренно: любое из этих полей означало бы сбор
      // персональных данных работника, чего платформа делать не вправе.
      guestRequireFullName: false,
      guestRequirePosition: false,
      guestRequireContact: false,
      eduGroupName: input.groupName,
    }),
  });
}

export async function cancelSession(sabakLessonId: string): Promise<void> {
  await call<unknown>(`/my/lessons/${sabakLessonId}`, { method: "DELETE" });
}

export async function rescheduleSession(
  sabakLessonId: string,
  scheduledAt: Date,
  durationMin: number,
): Promise<void> {
  await call<unknown>(`/my/lessons/${sabakLessonId}`, {
    method: "PATCH",
    body: JSON.stringify({
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes: durationMin,
    }),
  });
}

/**
 * Доступ работника к встрече. Внутрь уходит только платформенный логин — он же
 * и отображаемое имя в списке участников.
 */
export async function guestAccess(
  sabakLessonId: string,
  memberLogin: string,
): Promise<{ joinUrl: string; expiresAt: string }> {
  return call<{ joinUrl: string; expiresAt: string }>(
    `/lessons/${sabakLessonId}/guest-access`,
    {
      method: "POST",
      body: JSON.stringify({ externalId: memberLogin, displayName: memberLogin }),
    },
  );
}

export interface AttendanceSummary {
  participants: { externalId: string; attended: boolean }[];
}

/** Посещаемость сводкой: «был / не был», без минут (решение владельца). */
export async function attendanceSummary(
  sabakLessonId: string,
): Promise<AttendanceSummary> {
  return call<AttendanceSummary>(`/lessons/${sabakLessonId}/attendance/summary`);
}

export async function listRecordings(
  sabakLessonId: string,
): Promise<{ id: string; isReady: boolean; durationSeconds: number }[]> {
  const res = await call<{
    data?: { id: string; isReady: boolean; durationSeconds: number }[];
  }>(`/lessons/${sabakLessonId}/recordings`);
  return res.data ?? [];
}

/**
 * Ссылка на запись — короткая и одноразовая по смыслу. Постоянных ссылок мы не
 * храним: запись принадлежит только той компании, для которой прошла встреча, а
 * пересланный URL иначе жил бы вечно (docs/LIVE-SESSIONS-PLAN.md §6).
 */
export async function recordingLink(
  recordingId: string,
  ttlMinutes = 60,
): Promise<{ url: string; expiresAt: string }> {
  return call<{ url: string; expiresAt: string }>(`/recordings/${recordingId}/link`, {
    method: "POST",
    body: JSON.stringify({ ttlMinutes }),
  });
}

/** Диагностика для консоли владельца: доступен ли SABAK и под кем мы работаем. */
export async function ping(): Promise<{ ok: boolean; detail: string }> {
  if (!liveEnabled()) return { ok: false, detail: "интеграция выключена" };
  try {
    const me = await call<{ firstName?: string; lastName?: string; role?: string }>(
      "/auth/me",
    );
    const who = [me.lastName, me.firstName].filter(Boolean).join(" ") || "—";
    return { ok: true, detail: `${who}${me.role ? `, ${me.role}` : ""}` };
  } catch (e) {
    log.warn({ err: e }, "live.sabak.ping failed");
    return { ok: false, detail: e instanceof Error ? e.message : "нет связи" };
  }
}
