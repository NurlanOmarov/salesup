"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Plus, X } from "lucide-react";
import type { HotspotData } from "@/lib/interactive";

/**
 * Hotspot-схема: изображение (схема воронки, этапы визита) с кликабельными точками.
 * Нажатие на точку раскрывает подпись и пояснение. Изучение схемы интерактивом.
 *
 * Карточка пояснения раскрывается «от точки внутрь схемы»: у нижних точек — вверх,
 * у крайних — в сторону центра. Иначе она уходит за границу схемы (у контейнера
 * overflow-hidden ради скруглений) и текст обрезается. Сама карточка не ловит
 * клики (pointer-events-none): развернувшись, она перекрывает соседние точки, и
 * иначе до них не добраться, не закрыв текущую.
 */
export function HotspotImage({ data }: { data: HotspotData }) {
  const [active, setActive] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<number>>(new Set());

  const total = data.points.length;
  const done = seen.size === total;
  const left = total - seen.size;

  const open = (i: number) => {
    setActive((cur) => (cur === i ? null : i));
    setSeen((s) => new Set(s).add(i));
  };

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Задание: разобрать схему по точкам</p>
          <p className="mt-0.5 text-sm text-foreground/65">
            {data.caption ?? "Откройте каждую точку — под ней разбор из урока."}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-foreground/15 px-2.5 py-1 text-xs font-medium text-foreground/60">
          {seen.size} из {total}
        </span>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-xl border border-foreground/10 bg-foreground/[0.03]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.image} alt={data.caption ?? "Схема"} className="block w-full select-none" />

        {data.points.map((p, i) => {
          const isActive = active === i;
          // Точка ниже середины — карточка вверх; ближе к краю — прижимаем к точке,
          // чтобы она разворачивалась внутрь схемы, а не за её границу.
          const placement = [
            p.y < 58 ? "top-5" : "bottom-5",
            p.x < 24 ? "left-0" : p.x > 76 ? "right-0" : "left-1/2 -translate-x-1/2",
          ].join(" ");
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
                    className={`pointer-events-none absolute z-10 w-56 max-w-[min(16rem,80vw)] rounded-xl border border-foreground/15 bg-background p-3 text-left shadow-xl ${placement}`}
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

      {done ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-emerald-600">
          <CheckCircle2 className="size-4" />
          Задание выполнено: вы разобрали все точки схемы.
        </p>
      ) : (
        <p className="mt-3 text-sm text-foreground/55">
          Нажимайте на точки — под каждой пояснение из урока. Осталось разобрать: {left}.
        </p>
      )}
    </div>
  );
}
