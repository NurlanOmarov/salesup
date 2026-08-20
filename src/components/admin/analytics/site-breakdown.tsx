"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { SiteBreakdownRow } from "@/lib/analytics/dashboard";
import { fmtInt, fmtPct, countryFlag } from "@/lib/analytics/format";
import { EmptyHint } from "@/components/admin/analytics/panel";

/**
 * Сводка «по доменам» в режиме «Все домены» — клик по строке переключает
 * дашборд на этот домен (?site=<code>), как и SiteSwitch.
 */
export function SiteBreakdown({ rows }: { rows: SiteBreakdownRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (rows.length === 0) return <EmptyHint>Нет данных за период</EmptyHint>;

  function openSite(code: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("site", code);
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-foreground/10 text-left text-xs uppercase tracking-wide text-foreground/40">
            <th className="pb-2 pr-3 font-medium">Домен</th>
            <th className="pb-2 pr-3 font-medium">Посетители</th>
            <th className="pb-2 pr-3 font-medium">Заявки</th>
            <th className="pb-2 pr-3 font-medium">Записи</th>
            <th className="pb-2 font-medium">Конверсия</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-foreground/5">
          {rows.map((r) => {
            const isNone = r.code === "none";
            return (
              <tr
                key={r.code}
                onClick={() => openSite(r.code)}
                className={
                  "cursor-pointer transition-colors hover:bg-foreground/[0.04]" + (isNone ? " text-foreground/40" : "")
                }
              >
                <td className="py-2 pr-3 font-medium">
                  {isNone ? "🌐" : countryFlag(r.code)} {r.label}
                  {isNone ? <span className="ml-1.5 text-xs font-normal">до внедрения разметки</span> : null}
                </td>
                <td className="py-2 pr-3">{fmtInt(r.visitors)}</td>
                <td className="py-2 pr-3">{fmtInt(r.leads)}</td>
                <td className="py-2 pr-3">{fmtInt(r.enrollments)}</td>
                <td className="py-2">{fmtPct(r.conversion)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
