/**
 * Время встречи и календарный файл. Чистые функции без БД — покрыты тестами.
 *
 * Зачем отдельный модуль: рынки платформы разнесены на два часа (Минск и Москва
 * +3, Астана и Ташкент +5). Встреча, показанная в зоне сервера, — это сорванная
 * встреча, поэтому время всегда живёт в UTC, а показывается в зоне компании.
 */

export const LIVE_TIMEZONES = [
  { value: "Europe/Minsk", label: "Минск (UTC+3)" },
  { value: "Europe/Moscow", label: "Москва (UTC+3)" },
  { value: "Asia/Almaty", label: "Алматы / Астана (UTC+5)" },
  { value: "Asia/Tashkent", label: "Ташкент (UTC+5)" },
] as const;

/** «10 сентября, 14:00» в зоне компании. */
export function formatInZone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date);
}

/** Короткая метка зоны для подписи рядом со временем: «Минск». */
export function zoneLabel(timezone: string): string {
  return (
    LIVE_TIMEZONES.find((z) => z.value === timezone)?.label.split(" (")[0] ??
    timezone
  );
}

/**
 * Локальное время из формы («2026-09-10T14:00» в зоне компании) → UTC.
 *
 * Intl умеет только показывать в зоне, но не разбирать из неё, поэтому смещение
 * вычисляем сравнением: как выглядит момент-кандидат в целевой зоне и насколько
 * это расходится с тем, что ввёл человек. Двух проходов достаточно, чтобы
 * попасть точно даже на переводе часов.
 */
export function zonedInputToUtc(local: string, timezone: string): Date {
  const [datePart, timePart] = local.split("T");
  if (!datePart || !timePart) throw new Error("Некорректные дата и время");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  if (!y || !m || !d || hh === undefined || mm === undefined) {
    throw new Error("Некорректные дата и время");
  }

  const wanted = Date.UTC(y, m - 1, d, hh, mm);
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    guess = wanted + (guess - zonedTime(new Date(guess), timezone));
  }
  return new Date(guess);
}

/** Момент, «как его видят» в зоне, выраженный в миллисекундах UTC-шкалы. */
function zonedTime(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  // hour12: false отдаёт 24 для полуночи в некоторых движках — нормализуем.
  const hour = get("hour") % 24;
  return Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  );
}

/** Значение для `<input type="datetime-local">` в зоне компании. */
export function utcToZonedInput(date: Date, timezone: string): string {
  const ms = zonedTime(date, timezone);
  return new Date(ms).toISOString().slice(0, 16);
}

function icsStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Календарный файл встречи. Отдаём вместо письма: e-mail работника платформа не
 * знает, а .ics открывается любым календарём и переносится в телефон.
 */
export function buildIcs(session: {
  id: string;
  title: string;
  scheduledAt: Date;
  durationMin: number;
  joinUrl?: string | null;
}): string {
  const end = new Date(session.scheduledAt.getTime() + session.durationMin * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ACTIVE SALES//Live sessions//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:live-${session.id}@activesales`,
    `DTSTAMP:${icsStamp(new Date(0))}`,
    `DTSTART:${icsStamp(session.scheduledAt)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${escapeIcs(session.title)}`,
    ...(session.joinUrl ? [`URL:${escapeIcs(session.joinUrl)}`] : []),
    ...(session.joinUrl
      ? [`DESCRIPTION:${escapeIcs(`Ссылка для входа: ${session.joinUrl}`)}`]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // CRLF обязателен: календари Apple и Outlook отвергают файл с одним \n.
  return lines.join("\r\n") + "\r\n";
}

function escapeIcs(value: string): string {
  return value.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

/**
 * Пересекаются ли две встречи. Тренер один (решение владельца, §9 плана),
 * поэтому занятый слот — жёсткий запрет, а не подсказка: две встречи в одно
 * время означают две сорванные встречи.
 */
export function overlaps(
  aStart: Date,
  aDurationMin: number,
  bStart: Date,
  bDurationMin: number,
): boolean {
  const aFrom = aStart.getTime();
  const aTo = aFrom + aDurationMin * 60_000;
  const bFrom = bStart.getTime();
  const bTo = bFrom + bDurationMin * 60_000;
  // Встык — не пересечение: встреча 14:00–15:00 не мешает следующей в 15:00.
  return bFrom < aTo && aFrom < bTo;
}
