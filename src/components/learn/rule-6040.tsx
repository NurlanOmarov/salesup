"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Plus, X, Zap } from "lucide-react";
import type { Rule6040Data } from "@/lib/interactive";

/**
 * Правило 60/40: планируй жёстко не больше 60% дня, остальное — буфер на
 * непредвиденное. Ученик добавляет дела с длительностью, кольцо дня заполняется;
 * кнопка «Прилетело срочное» показывает, зачем нужен резерв: при заполнении ≤60%
 * срочное влезает, при перегрузе — день лопается. Оболочка без AI-контента.
 */

type Task = { id: number; text: string; hours: number; urgent?: boolean };

const R = 70;
const CIRC = 2 * Math.PI * R;

export function Rule6040({ data }: { data: Rule6040Data }) {
  const nextId = useRef(0);
  const [tasks, setTasks] = useState<Task[]>(() =>
    (data.seedTasks ?? []).map((t) => ({ id: nextId.current++, text: t.text, hours: t.hours })),
  );
  const [draft, setDraft] = useState("");
  const [hours, setHours] = useState(1);
  const [overflowMsg, setOverflowMsg] = useState(false);

  const day = data.dayHours;
  const total = tasks.reduce((s, t) => s + t.hours, 0);
  const frac = total / day;
  const pct = Math.round(frac * 100);

  const zone = frac <= 0.6 ? "ok" : frac <= 1 ? "warn" : "over";
  const color = zone === "ok" ? "#10b981" : zone === "warn" ? "#f59e0b" : "#ef4444";
  const arcFrac = Math.min(frac, 1);

  function add(text: string, h: number, urgent = false) {
    const v = text.trim();
    if (!v) return;
    setTasks((p) => [...p, { id: nextId.current++, text: v, hours: h, urgent }]);
  }

  function addUrgent() {
    add("🔥 Срочное — прилетело сейчас", 1, true);
    if ((total + 1) / day > 1) setOverflowMsg(true);
  }

  const msg =
    zone === "ok"
      ? "Отлично: спланировано ≤ 60%, а 40% дня свободно на непредвиденное."
      : zone === "warn"
        ? "Буфер тает. Оставьте ~40% на срочное — иначе один сдвиг сломает план."
        : "День переполнен! Резерв съеден — срочное уже не влезает, дела поедут.";

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-6">
      <h3 className="font-bold">{data.title}</h3>
      <p className="mt-1 text-sm text-foreground/65">{data.prompt}</p>

      <div className="mt-5 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <span className="text-xs font-medium text-foreground/55">
            Дела и сколько часов займут (день = {day} ч)
          </span>
          <div className="mt-1.5 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add(draft, hours);
                  setDraft("");
                }
              }}
              placeholder="Дело…"
              className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <div className="flex shrink-0 items-center rounded-lg border border-foreground/15 px-2">
              <input
                type="number"
                min={0.5}
                max={day}
                step={0.5}
                value={hours}
                onChange={(e) => setHours(Math.max(0.5, Number(e.target.value) || 0.5))}
                aria-label="Часы"
                className="w-12 bg-transparent text-right text-sm outline-none"
              />
              <span className="ml-1 text-xs text-foreground/50">ч</span>
            </div>
            <button
              type="button"
              onClick={() => {
                add(draft, hours);
                setDraft("");
              }}
              disabled={!draft.trim()}
              aria-label="Добавить дело"
              className="flex shrink-0 items-center justify-center rounded-lg bg-brand px-3 text-white transition-opacity disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={addUrgent}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-500/20"
          >
            <Zap className="size-3.5" />
            Прилетело срочное (+1 ч)
          </button>

          <ul className="mt-3 space-y-1.5">
            {tasks.map((t) => (
              <li
                key={t.id}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                  t.urgent ? "bg-red-500/10" : "bg-foreground/[0.04]"
                }`}
              >
                <span className="flex-1 text-foreground/80">{t.text}</span>
                <span className="text-xs font-semibold text-foreground/50">{t.hours} ч</span>
                <button
                  type="button"
                  onClick={() => setTasks((p) => p.filter((x) => x.id !== t.id))}
                  aria-label="Убрать"
                  className="text-foreground/30 transition-colors hover:text-foreground/70"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Кольцо дня */}
        <div className="flex flex-col items-center gap-2 justify-self-center">
          <svg viewBox="0 0 180 180" className="h-44 w-44 -rotate-90">
            <circle cx="90" cy="90" r={R} fill="none" stroke="currentColor" strokeWidth="16" className="text-foreground/10" />
            <motion.circle
              cx="90"
              cy="90"
              r={R}
              fill="none"
              stroke={color}
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              initial={false}
              animate={{ strokeDashoffset: CIRC * (1 - arcFrac), stroke: color }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
            {/* метка 60% */}
            <line
              x1="90"
              y1="6"
              x2="90"
              y2="22"
              stroke="currentColor"
              strokeWidth="3"
              className="text-foreground/40"
              transform="rotate(216 90 90)"
            />
          </svg>
          <div className="-mt-28 mb-16 text-center">
            <div className="text-2xl font-bold" style={{ color }}>
              {pct}%
            </div>
            <div className="text-xs text-foreground/50">
              {Math.round(total * 10) / 10} / {day} ч
            </div>
          </div>
          <span className="text-[11px] font-medium text-foreground/45">метка — предел 60%</span>
        </div>
      </div>

      <p
        className={`mt-4 rounded-xl border px-4 py-2.5 text-sm font-medium ${
          zone === "ok"
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
            : zone === "warn"
              ? "border-amber-500/30 bg-amber-500/10 text-amber-800"
              : "border-red-500/30 bg-red-500/10 text-red-700"
        }`}
      >
        {msg}
      </p>

      {overflowMsg && zone === "over" ? (
        <p className="mt-2 text-xs text-red-600">
          Видишь? Забил день под завязку — и первое же срочное дело выбросило план за 100%.
        </p>
      ) : null}
    </div>
  );
}
