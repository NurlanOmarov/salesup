import { CalendarPlus, PlayCircle, Video } from "lucide-react";
import { formatInZone, zoneLabel } from "@/lib/live/format";
import { listForOrg } from "@/lib/live/service";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Встречи с тренером в кабинете компании и в кабинете работника.
 *
 * Один блок на два кабинета: ответственному представителю и работнику нужно
 * ровно одно и то же — когда встреча, как войти и где запись. Разница только в
 * заголовке, поэтому разводить два похожих компонента незачем.
 *
 * Ссылка на вход всегда ведёт на наш маршрут `/api/live/<id>/join`: он проверит
 * права и выдаст персональный доступ. Гостевая ссылка SABAK в разметку не
 * попадает никогда.
 */
export async function LiveSessionsBlock({
  orgId,
  title = "Встречи с тренером",
  limitPast = 3,
}: {
  orgId: string;
  title?: string;
  limitPast?: number;
}) {
  const sessions = await listForOrg(orgId);
  if (sessions.length === 0) return null;

  const now = Date.now();
  const isPast = (s: (typeof sessions)[number]) =>
    s.scheduledAt.getTime() + s.durationMin * 60_000 < now;

  const upcoming = sessions.filter((s) => !isPast(s));
  const past = sessions
    .filter(isPast)
    .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())
    .slice(0, limitPast);

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>

      {upcoming.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {upcoming.map((s) => {
            // Кнопка входа появляется за 15 минут: раньше в комнате никого нет,
            // и человек решает, что ссылка сломана.
            const opensAt = s.scheduledAt.getTime() - 15 * 60_000;
            const canJoin = now >= opensAt;
            return (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-background p-4"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    <Video className="size-4 shrink-0 text-foreground/40" />
                    {s.title}
                  </p>
                  <p className="mt-1 text-sm text-foreground/65">
                    {formatInZone(s.scheduledAt, s.timezone)} ({zoneLabel(s.timezone)})
                    · {s.durationMin} мин
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`/api/live/${s.id}/ics`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "gap-1.5",
                    )}
                  >
                    <CalendarPlus className="size-4" />В календарь
                  </a>
                  {canJoin ? (
                    <a
                      href={`/api/live/${s.id}/join`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({ variant: "brand", size: "sm" })}
                    >
                      Войти
                    </a>
                  ) : (
                    <span className="text-xs text-foreground/50">
                      вход откроется за 15 минут
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-foreground/55">
          Ближайших встреч нет — тренер назначит дату и она появится здесь.
        </p>
      )}

      {past.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {past.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground/75">{s.title}</p>
                <p className="mt-0.5 text-xs text-foreground/50">
                  {formatInZone(s.scheduledAt, s.timezone)} ({zoneLabel(s.timezone)})
                  {s.attendedCount !== null ? ` · было ${s.attendedCount} чел.` : ""}
                </p>
              </div>
              {s.recordingReady ? (
                <a
                  href={`/api/live/${s.id}/recording`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "gap-1.5",
                  )}
                >
                  <PlayCircle className="size-4" />
                  Смотреть запись
                </a>
              ) : (
                <span className="text-xs text-foreground/45">запись готовится</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
