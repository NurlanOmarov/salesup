import { cn } from "@/lib/utils";
import type { NamedCount } from "@/lib/analytics/dashboard";
import { fmtInt } from "@/lib/analytics/format";
import { EmptyHint } from "./panel";

/**
 * Горизонтальный список с фоновыми барами (топ страниц, источники трафика).
 * Бар — доля от максимума; значение выровнено вправо. renderLabel — кастом метки.
 */
export function BarList({
  items,
  color = "var(--color-brand)",
  empty = "Нет данных за период",
  renderLabel,
}: {
  items: NamedCount[];
  color?: string;
  empty?: string;
  renderLabel?: (item: NamedCount) => React.ReactNode;
}) {
  if (items.length === 0) return <EmptyHint>{empty}</EmptyHint>;
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.key} className="group relative">
          <div
            className="absolute inset-y-0 left-0 rounded-md transition-all"
            style={{
              width: `${(item.value / max) * 100}%`,
              background: color,
              opacity: 0.1,
            }}
          />
          <div className="relative flex items-center justify-between gap-3 px-2.5 py-1.5">
            <span className="min-w-0 flex-1 truncate text-sm">
              {renderLabel ? renderLabel(item) : item.label}
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">{fmtInt(item.value)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Строка-источник: хост как ссылка-подобная метка. */
export function SourceLabel({ host }: { host: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded bg-foreground/5 text-[10px] font-bold uppercase text-foreground/50",
        )}
      >
        {host.replace(/^www\./, "")[0] ?? "?"}
      </span>
      <span className="truncate">{host.replace(/^www\./, "")}</span>
    </span>
  );
}
