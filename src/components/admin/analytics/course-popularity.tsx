import Link from "next/link";
import { Eye, Inbox, GraduationCap, ArrowUpRight } from "lucide-react";
import type { CoursePopularity } from "@/lib/analytics/dashboard";
import { fmtInt, fmtPct } from "@/lib/analytics/format";
import { EmptyHint } from "./panel";

/**
 * Рейтинг курсов по популярности: воронка просмотры → заявки → записи для каждого
 * курса, с баром доли просмотров относительно лидера и конверсией. Сортировка —
 * из dashboard (по просмотрам). Это ответ на «какие курсы популярнее».
 */
export function CoursePopularityTable({ courses }: { courses: CoursePopularity[] }) {
  if (courses.length === 0) {
    return <EmptyHint>Нет опубликованных курсов или данных за период</EmptyHint>;
  }
  const maxViews = Math.max(...courses.map((c) => c.views), 1);

  return (
    <div className="space-y-2">
      {courses.map((c, i) => (
        <div
          key={c.slug}
          className="group rounded-xl border border-foreground/8 p-3 transition-colors hover:border-brand/25 hover:bg-foreground/[0.015]"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-foreground/5 text-xs font-bold text-foreground/50">
                {i + 1}
              </span>
              <Link
                href={`/courses/${c.slug}`}
                className="inline-flex min-w-0 items-center gap-1 truncate text-sm font-medium hover:text-brand"
              >
                <span className="truncate">{c.title}</span>
                <ArrowUpRight className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
              </Link>
            </div>
            <span
              className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-600"
              title="Конверсия просмотр → запись"
            >
              {fmtPct(c.conversion)}
            </span>
          </div>

          {/* Бар доли просмотров */}
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/5">
            <div className="h-full rounded-full bg-brand/70" style={{ width: `${(c.views / maxViews) * 100}%` }} />
          </div>

          {/* Воронка числами */}
          <div className="mt-2 flex items-center gap-4 text-xs text-foreground/60">
            <Metric icon={<Eye className="size-3.5" />} label="просмотры" value={c.views} />
            <span className="text-foreground/20">→</span>
            <Metric icon={<Inbox className="size-3.5" />} label="заявки" value={c.leads} />
            <span className="text-foreground/20">→</span>
            <Metric icon={<GraduationCap className="size-3.5" />} label="записи" value={c.enrollments} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1" title={label}>
      <span className="text-foreground/40">{icon}</span>
      <span className="font-semibold tabular-nums text-foreground/80">{fmtInt(value)}</span>
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}
