import "server-only";
import { env } from "@/env";
import { log } from "@/lib/log";

/**
 * Клиент SABAK.kz — единственное место, где мы разговариваем с видеосервисом
 * (docs/LIVE-SESSIONS-PLAN.md, docs/SABAK-INTEGRATION-REQUEST.md).
 *
 * Авторизация — сервисный ключ (`client_credentials`, RFC 6749), скоупы
 * `lessons:write lessons:read guests:issue recordings:read`. Пароль живого
 * пользователя платформа не хранит вовсе.
 *
 * Формат ответов: `/oauth/token` отвечает без конверта (того требует стандарт),
 * все остальные эндпоинты заворачивают полезную нагрузку в `{ success, data }`.
 * Разворачиваем в одном месте — `call()`, чтобы это знание не расползлось.
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
    /** Машинный код из ответа SABAK: ENTITLEMENT_REQUIRED, INSUFFICIENT_SCOPE… */
    readonly code?: string,
  ) {
    super(message);
    this.name = "SabakError";
  }
}

/** Готова ли интеграция: без этого раздел встреч не показывается вовсе. */
export function liveEnabled(): boolean {
  return !!(
    env.LIVE_SESSIONS_ENABLED &&
    env.SABAK_BASE_URL &&
    env.SABAK_CLIENT_ID &&
    env.SABAK_CLIENT_SECRET
  );
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

  const res = await fetch(`${env.SABAK_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: env.SABAK_CLIENT_ID,
      client_secret: env.SABAK_CLIENT_SECRET,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  // Единственный эндпоинт без конверта {success,data} — так требует RFC 6749.
  const data = (await safeJson(res)) as { access_token?: string; expires_in?: number };
  if (!res.ok || !data?.access_token) {
    throw new SabakError("SABAK не выдал сервисный токен", res.status);
  }

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 1800) * 1000,
  };
  return cachedToken.value;
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
  const { idempotencyKey, ...rest } = init;
  const res = await fetch(`${env.SABAK_BASE_URL}${path}`, {
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

  // 401 бывает и после отзыва ключа, и просто по истечении токена — различить
  // их по ответу нельзя, поэтому один раз пробуем перелогиниться.
  if (res.status === 401 && retry) {
    resetTokenCache();
    return call<T>(path, init, false);
  }

  const body = (await safeJson(res)) as
    | { success?: boolean; data?: T; error?: { code?: string; message?: string } }
    | null;

  if (!res.ok) {
    const code = body?.error?.code;
    throw new SabakError(explain(code, body?.error?.message, res.status), res.status, code);
  }
  // Полезная нагрузка лежит в data; вырожденный ответ без конверта тоже терпим.
  return (body && "data" in body ? (body.data as T) : (body as unknown as T));
}

/**
 * Коды ошибок SABAK → фразы, по которым владелец поймёт, что делать. Особенно
 * важен 402: это не сбой интеграции, а невыданный тариф у учётки тренера, и
 * искать его надо в админке SABAK, а не в нашем коде.
 */
function explain(code: string | undefined, message: string | undefined, status: number): string {
  switch (code) {
    case "ENTITLEMENT_REQUIRED":
      return "Учётке тренера в SABAK не выдан тариф на встречи (create_lesson / record_lesson)";
    case "INSUFFICIENT_SCOPE":
    case "ENDPOINT_NOT_AVAILABLE_TO_API_CLIENT":
      return "Сервисному ключу не хватает прав — проверьте скоупы в /admin/api-clients";
    case "API_CLIENT_REVOKED":
    case "INVALID_CLIENT":
      return "Сервисный ключ отозван или неверен — выпустите новый";
    case "IDEMPOTENCY_KEY_REUSED":
      return "Встреча уже создавалась с этим ключом, но с другими параметрами";
    case "LESSON_NOT_FOUND":
      return "Встреча не найдена в SABAK (или принадлежит другому workspace)";
    case "GUESTS_NOT_ALLOWED":
      return "У встречи выключен гостевой вход";
    case "LINK_EXPIRED":
      return "Ссылка на встречу истекла: прошло больше суток с её начала";
    case "RECORDING_NOT_READY":
      return "Запись ещё обрабатывается";
    default:
      return message ?? `SABAK ответил ${status}`;
  }
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
): Promise<{ joinUrl: string; joinToken: string; expiresAt: string }> {
  // joinUrl содержит одноразовый билет на 15 минут: он гаснет при первом входе,
  // поэтому ссылку выдаём в момент клика, а не кладём в вёрстку заранее.
  return call<{ joinUrl: string; joinToken: string; expiresAt: string }>(
    `/lessons/${sabakLessonId}/guest-access`,
    {
      method: "POST",
      body: JSON.stringify({ externalId: memberLogin, displayName: memberLogin }),
    },
  );
}

export interface AttendanceSummary {
  lessonId: string;
  status: string;
  finishedAt: string | null;
  participants: { externalId: string; attended: boolean }[];
}

/**
 * Посещаемость сводкой: «был / не был». Порог присутствия задаём явно, а не
 * полагаемся на умолчание чужого сервиса — иначе отчёт клиенту поедет, если
 * SABAK когда-нибудь поменяет дефолт.
 */
export async function attendanceSummary(
  sabakLessonId: string,
  minMinutes = 10,
): Promise<AttendanceSummary> {
  return call<AttendanceSummary>(
    `/lessons/${sabakLessonId}/attendance/summary?minMinutes=${minMinutes}`,
  );
}

export interface SabakRecording {
  id: string;
  ready: boolean;
  durationSeconds: number;
}

export async function listRecordings(
  sabakLessonId: string,
): Promise<SabakRecording[]> {
  const res = await call<{ lessonId: string; recordings?: SabakRecording[] }>(
    `/lessons/${sabakLessonId}/recordings`,
  );
  return res.recordings ?? [];
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
  return call<{ url: string; expiresAt: string; allowDownload: boolean }>(
    `/recordings/${recordingId}/link`,
    {
      method: "POST",
      // allowDownload передаём явно: на той стороне это умолчание, а запись
      // компании не должна утечь файлом из-за смены чужого дефолта.
      body: JSON.stringify({ ttlMinutes, allowDownload: false }),
    },
  );
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
