import type { NamedCount } from "@/lib/analytics/dashboard";
import { countryFlag, countryName, fmtInt } from "@/lib/analytics/format";
import { EmptyHint } from "./panel";

/**
 * География посетителей: флаг + русское название страны, бар доли и число посетителей.
 * Данные — из своих page.view (ISO-код по IP через geoip-lite, сам IP не хранится).
 */
export function CountryList({ items }: { items: NamedCount[] }) {
  if (items.length === 0) {
    return <EmptyHint>Пока нет данных о странах — соберутся после первых визитов</EmptyHint>;
  }
  const total = items.reduce((s, i) => s + (i.visitors ?? i.value), 0);
  const max = Math.max(...items.map((i) => i.visitors ?? i.value), 1);

  return (
    <ul className="space-y-2.5">
      {items.map((c) => {
        const count = c.visitors ?? c.value;
        const share = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <li key={c.key} className="flex items-center gap-3">
            <span className="text-lg leading-none">{countryFlag(c.key)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm">{countryName(c.key)}</span>
                <span className="shrink-0 text-sm tabular-nums text-foreground/50">
                  {fmtInt(count)} · {share}%
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-foreground/5">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
