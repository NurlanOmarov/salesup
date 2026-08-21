import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Video } from "lucide-react";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth/guards";
import { formatInZone, zoneLabel } from "@/lib/live/format";
import { liveEnabled, ping } from "@/lib/live/sabak";
import { listAll } from "@/lib/live/service";
import {
  KIND_LABELS,
  PlanSessionForm,
  SessionActions,
  type SessionRow,
} from "./live-manager";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Живые сессии",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Живые сессии с тренером (docs/LIVE-SESSIONS-PLAN.md).
 *
 * Тренер один, поэтому здесь его общий календарь: все встречи всех клиентов в
 * одном списке, а занятое время нельзя продать дважды (проверка в actions).
 */
export default async function AdminLivePage() {
  await requireOwner();

  const [orgs, courses, sessions, health] = await Promise.all([
    db.organization.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.course.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true },
    }),
    listAll(),
    ping(),
  ]);

  const now = Date.now();
  const rows: SessionRow[] = sessions.map((s) => ({
    id: s.id,
    orgId: s.orgId,
    orgName: s.org.name,
    kind: s.kind,
    title: s.title,
    scheduledAtIso: s.scheduledAt.toISOString(),
    when: formatInZone(s.scheduledAt, s.timezone),
    zone: zoneLabel(s.timezone),
    timezone: s.timezone,
    durationMin: s.durationMin,
    status: s.status,
    joinUrl: s.joinUrl,
    remoteCreated: !!s.sabakLessonId,
    recordingReady: s.recordingReady,
    attendedCount: s.attendedCount,
    isPast: s.scheduledAt.getTime() + s.durationMin * 60_000 < now,
  }));

  const upcoming = rows.filter((r) => !r.isPast && r.status !== "CANCELLED");
  const past = rows.filter((r) => r.isPast || r.status === "CANCELLED");

  return (
    <main>
      <h1 className="text-2xl font-bold">Живые сессии с тренером</h1>
      <p className="mt-1 max-w-3xl text-sm text-foreground/60">
        Вводная и итоговая встречи из пакета «Платформа + живой тренер». Видео —
        на стороне SABAK, здесь — расписание, доступ работников и итоги.
      </p>

      {/* Состояние интеграции — первым экраном: без него все кнопки бессмысленны. */}
      <p
        className={cn(
          "mt-4 flex max-w-3xl items-start gap-2 rounded-lg p-3 text-sm",
          health.ok
            ? "bg-emerald-500/[0.07] text-emerald-900"
            : "border border-amber-500/30 bg-amber-500/[0.07] text-amber-900",
        )}
      >
        {health.ok ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        ) : (
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        )}
        <span>
          {health.ok ? (
            <>SABAK на связи, работаем от учётной записи: {health.detail}.</>
          ) : liveEnabled() ? (
            <>SABAK не отвечает: {health.detail}. Встречи можно планировать — они
            создадутся, как только связь появится.</>
          ) : (
            <>
              Интеграция с SABAK выключена: встречи сохраняются здесь, но ссылки
              для входа не выдаются. Нужны{" "}
              <span className="font-mono">LIVE_SESSIONS_ENABLED</span>,{" "}
              <span className="font-mono">SABAK_BASE_URL</span> и доступ —
              подробности в{" "}
              <span className="font-mono">docs/LIVE-SESSIONS-PLAN.md</span>.
            </>
          )}
        </span>
      </p>

      <section className="mt-6">
        <PlanSessionForm orgs={orgs} courses={courses} />
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Ближайшие</h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-foreground/55">
            Встреч не назначено. Пакет с тренером продаётся в калькуляторе на
            странице{" "}
            <Link href="/business" className="underline">
              для компаний
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {upcoming.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Прошедшие и отменённые</h2>
          <ul className="mt-3 space-y-2">
            {past.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function SessionCard({ session }: { session: SessionRow }) {
  return (
    <li className="rounded-xl border border-foreground/10 bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <Video className="size-4 shrink-0 text-foreground/40" />
            <span className="font-medium">{session.title}</span>
            <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-xs text-foreground/60">
              {KIND_LABELS[session.kind]}
            </span>
            {session.status === "CANCELLED" ? (
              <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs text-foreground/60">
                отменена
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-foreground/65">
            {session.orgName} · {session.when} ({session.zone}) ·{" "}
            {session.durationMin} мин
          </p>
          <p className="mt-1 text-xs text-foreground/50">
            {session.remoteCreated ? "Создана в SABAK" : "В SABAK ещё не создана"}
            {session.attendedCount !== null
              ? ` · было ${session.attendedCount} чел.`
              : ""}
            {session.recordingReady ? " · запись готова" : ""}
          </p>
        </div>

        {session.status !== "CANCELLED" ? <SessionActions session={session} /> : null}
      </div>
    </li>
  );
}
