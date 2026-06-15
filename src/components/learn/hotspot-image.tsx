"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import type { HotspotData } from "@/lib/interactive";

/**
 * Hotspot-схема: изображение (схема воронки, этапы визита) с кликабельными точками.
 * Нажатие на точку раскрывает подпись и пояснение. Изучение схемы интерактивом.
 */
export function HotspotImage({ data }: { data: HotspotData }) {
  const [active, setActive] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<number>>(new Set());

  const open = (i: number) => {
    setActive((cur) => (cur === i ? null : i));
    setSeen((s) => new Set(s).add(i));
  };

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">Нажимайте на точки схемы</p>
        <span className="text-sm text-foreground/55">
          {seen.size}/{data.points.length}
        </span>
      </div>
      {data.caption ? <p className="mt-0.5 text-sm text-foreground/55">{data.caption}</p> : null}

      <div className="relative mt-4 overflow-hidden rounded-xl border border-foreground/10 bg-foreground/[0.03]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.image} alt={data.caption ?? "Схема"} className="block w-full select-none" />

        {data.points.map((p, i) => {
          const isActive = active === i;
          return (
            <div key={i} className="absolute" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
              <button
                onClick={() => open(i)}
                aria-label={p.label}
                className={[
                  "flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white shadow-md transition-transform hover:scale-110",
                  isActive ? "bg-amber-500" : seen.has(i) ? "bg-emerald-500" : "bg-sky-500",
                ].join(" ")}
              >
                {isActive ? <X className="size-4 text-white" /> : <Plus className="size-4 text-white" />}
              </button>

              <AnimatePresence>
                {isActive ? (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="absolute left-1/2 top-5 z-10 w-56 -translate-x-1/2 rounded-xl border border-foreground/15 bg-background p-3 text-left shadow-xl"
                  >
                    <p className="text-sm font-semibold text-amber-700">{p.label}</p>
                    <p className="mt-1 text-xs text-foreground/70">{p.text}</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
