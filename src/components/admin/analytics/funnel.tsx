import { cn } from "@/lib/utils";
import type { Funnel as FunnelData } from "@/lib/analytics/dashboard";
import { fmtInt, fmtPct } from "@/lib/analytics/format";

/**
 * Общая воронка конверсии: просмотры → просмотры курсов → заявки → записи.
 * Ширина ступени — доля от вершины воронки; между ступенями — % перехода.
 */
export function Funnel({ data }: { data: FunnelData }) {
  const steps = [
    { label: "Все просмотры", value: data.views, color: "bg-slate-400/80" },
    { label: "Просмотры курсов", value: data.courseViews, color: "bg-amber-500/80" },
    { label: "Заявки", value: data.leads, color: "bg-brand/80" },
    { label: "Записи", value: data.enrollments, color: "bg-emerald-500/85" },
  ];
  const top = Math.max(data.views, 1);

  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1]!.value : null;
        const stepConv = prev && prev > 0 ? (s.value / prev) * 100 : null;
        return (
          <div key={s.label}>
            {i > 0 && (
              <div className="mb-1 flex items-center gap-2 pl-1 text-[11px] text-foreground/40">
                <span className="h-3 w-px bg-foreground/15" />
                {stepConv !== null ? `${fmtPct(stepConv)} переходят дальше` : "—"}
              </div>
            )}
            {/* Подпись — над полосой: полоса узких ступеней не обрезает текст */}
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="text-xs font-semibold text-foreground/80">{s.label}</span>
              <span className="shrink-0 text-sm font-bold tabular-nums">{fmtInt(s.value)}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-foreground/5">
              <div
                className={cn("h-full min-w-[0.625rem] rounded-full", s.color)}
                style={{ width: `${Math.max((s.value / top) * 100, 2)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
