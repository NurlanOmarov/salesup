"use client";

import { useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { TimePoint } from "@/lib/analytics/dashboard";
import { fmtInt } from "@/lib/analytics/format";

const SERIES = {
  visitors: { label: "Посетители", color: "#f4003a", prevKey: "prevVisitors" as const, key: "visitors" as const },
  views: { label: "Просмотры", color: "#f59e0b", prevKey: "prevViews" as const, key: "views" as const },
};

type Mode = "both" | "visitors" | "views";

/** Основной график трафика по дням: посетители + просмотры, опц. пунктир прошлого периода. */
export function TrafficChart({ data, compare }: { data: TimePoint[]; compare: boolean }) {
  const [mode, setMode] = useState<Mode>("both");
  const show = (k: "visitors" | "views") => mode === "both" || mode === k;

  return (
    <div className="text-foreground">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          {(["visitors", "views"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setMode(mode === k ? "both" : k)}
              className={cn(
                "inline-flex items-center gap-1.5 transition-opacity",
                !show(k) && "opacity-35",
              )}
            >
              <span className="size-2.5 rounded-full" style={{ background: SERIES[k].color }} />
              {SERIES[k].label}
            </button>
          ))}
        </div>
        {compare && (
          <span className="text-xs text-foreground/40">пунктир — прошлый период</span>
        )}
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <defs>
              {(["visitors", "views"] as const).map((k) => (
                <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES[k].color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={SERIES[k].color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => format(parseISO(d), "d MMM", { locale: ru })}
              tick={{ fill: "currentColor", fillOpacity: 0.45, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis
              tick={{ fill: "currentColor", fillOpacity: 0.45, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={40}
              allowDecimals={false}
            />
            <Tooltip content={<ChartTooltip compare={compare} mode={mode} />} />

            {compare &&
              (["visitors", "views"] as const)
                .filter(show)
                .map((k) => (
                  <Line
                    key={`prev-${k}`}
                    type="monotone"
                    dataKey={SERIES[k].prevKey}
                    stroke={SERIES[k].color}
                    strokeOpacity={0.4}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}

            {(["visitors", "views"] as const)
              .filter(show)
              .map((k) => (
                <Area
                  key={k}
                  type="monotone"
                  dataKey={SERIES[k].key}
                  stroke={SERIES[k].color}
                  strokeWidth={2}
                  fill={`url(#g-${k})`}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

type TooltipProps = {
  active?: boolean;
  label?: string;
  payload?: { dataKey: string; value: number }[];
  compare: boolean;
  mode: Mode;
};

function ChartTooltip({ active, label, payload }: TooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const get = (key: string) => payload.find((p) => p.dataKey === key)?.value;
  const rows: { label: string; value?: number; color: string; muted?: boolean }[] = [
    { label: "Посетители", value: get("visitors"), color: SERIES.visitors.color },
    { label: "Просмотры", value: get("views"), color: SERIES.views.color },
    { label: "Посетители (пр.)", value: get("prevVisitors"), color: SERIES.visitors.color, muted: true },
    { label: "Просмотры (пр.)", value: get("prevViews"), color: SERIES.views.color, muted: true },
  ].filter((r) => r.value !== undefined && r.value !== null);

  return (
    <div className="rounded-lg border border-foreground/10 bg-background px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-medium text-foreground/70">
        {format(parseISO(label), "d MMMM yyyy", { locale: ru })}
      </p>
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-foreground/60">
              <span
                className={cn("size-2 rounded-full", r.muted && "opacity-40")}
                style={{ background: r.color }}
              />
              {r.label}
            </span>
            <span className="font-semibold tabular-nums">{fmtInt(r.value!)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
