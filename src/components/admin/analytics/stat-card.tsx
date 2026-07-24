"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Metric } from "@/lib/analytics/dashboard";
import { fmtDelta } from "@/lib/analytics/format";

/**
 * KPI-карточка: крупное значение, дельта к прошлому периоду и мини-спарклайн.
 * accent — hex/культурный цвет линии графика (совпадает с легендой на большом графике).
 */
export function StatCard({
  label,
  value,
  metric,
  spark,
  accent,
  compare,
}: {
  label: string;
  value: string;
  metric: Metric;
  spark: number[];
  accent: string;
  compare: boolean;
}) {
  const data = spark.map((v, i) => ({ i, v }));
  const delta = metric.deltaPct;
  const gradId = `spark-${label}`;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-foreground/10 bg-background p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-foreground/60">{label}</span>
        {compare && delta !== null && <DeltaBadge pct={delta} />}
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
          {compare && metric.prev !== null && (
            <p className="mt-1 text-xs text-foreground/40">было {new Intl.NumberFormat("ru-RU").format(metric.prev)}</p>
          )}
        </div>
        {spark.length > 1 && (
          <div className="h-11 w-24 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={accent}
                  strokeWidth={1.75}
                  fill={`url(#${gradId})`}
                  isAnimationActive={false}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function DeltaBadge({ pct }: { pct: number }) {
  const dir = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        dir === "up" && "bg-emerald-500/10 text-emerald-600",
        dir === "down" && "bg-red-500/10 text-red-600",
        dir === "flat" && "bg-foreground/5 text-foreground/50",
      )}
    >
      <Icon className="size-3" />
      {fmtDelta(pct)}
    </span>
  );
}
