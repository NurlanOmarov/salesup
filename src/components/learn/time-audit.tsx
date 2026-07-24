"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import type { TimeAuditData } from "@/lib/interactive";

/**
 * Хронометраж / пожиратели времени. Ученик логирует часы дня по делам и помечает
 * «пожирателей». Круг дня показывает долю потерь, а внизу — экстраполяция на год
 * (шок-цифра сильнее процента). Оболочка без AI-контента и без сохранения.
 */

type Act = { id: number; text: string; hours: number; waster: boolean };

const CX = 100;
const CY = 100;
const RAD = 82;

function slicePath(startDeg: number, endDeg: number) {
  const rad = (d: number) => ((d - 90) * Math.PI) / 180;
  const x1 = CX + RAD * Math.cos(rad(startDeg));
  const y1 = CY + RAD * Math.sin(rad(startDeg));
  const x2 = CX + RAD * Math.cos(rad(endDeg));
  const y2 = CY + RAD * Math.sin(rad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M${CX},${CY} L${x1},${y1} A${RAD},${RAD} 0 ${large} 1 ${x2},${y2} Z`;
}

export function TimeAudit({ data }: { data: TimeAuditData }) {
  const nextId = useRef(0);
  const [acts, setActs] = useState<Act[]>(() =>
    (data.seedActivities ?? []).map((a) => ({ id: nextId.current++, text: a.text, hours: a.hours, waster: a.waster })),
  );
  const [draft, setDraft] = useState("");
  const [hours, setHours] = useState(1);

  const total = acts.reduce((s, a) => s + a.hours, 0);
  const wasted = acts.filter((a) => a.waster).reduce((s, a) => s + a.hours, 0);
  const wastedPct = total > 0 ? Math.round((wasted / total) * 100) : 0;
  // Экстраполяция: потери в день × 250 рабочих дней ÷ 40 ч в неделе.
  const weeksPerYear = Math.round((wasted * 250) / 40);

  // Углы секторов
  let acc = 0;
  const slices = acts
    .filter((a) => a.hours > 0)
    .map((a) => {
      const start = (acc / total) * 360;
      acc += a.hours;
      const end = (acc / total) * 360;
      return { a, start, end };
    });

  function add() {
    const v = draft.trim();
    if (!v) return;
    setActs((p) => [...p, { id: nextId.current++, text: v, hours, waster: false }]);
    setDraft("");
  }

  const toggleWaster = (id: number) =>
    setActs((p) => p.map((a) => (a.id === id ? { ...a, waster: !a.waster } : a)));

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-6">
      <h3 className="font-bold">{data.title}</h3>
      <p className="mt-1 text-sm text-foreground/65">{data.prompt}</p>

      <div className="mt-5 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <span className="text-xs font-medium text-foreground/55">
            На что ушло время — часы и пометьте «пожирателей»
          </span>
          <div className="mt-1.5 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="Занятие…"
              className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <div className="flex shrink-0 items-center rounded-lg border border-foreground/15 px-2">
              <input
                type="number"
                min={0.25}
                max={24}
                step={0.25}
                value={hours}
                onChange={(e) => setHours(Math.max(0.25, Number(e.target.value) || 0.25))}
                aria-label="Часы"
                className="w-12 bg-transparent text-right text-sm outline-none"
              />
              <span className="ml-1 text-xs text-foreground/50">ч</span>
            </div>
            <button
              type="button"
              onClick={add}
              disabled={!draft.trim()}
              aria-label="Добавить"
              className="flex shrink-0 items-center justify-center rounded-lg bg-brand px-3 text-white transition-opacity disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>

          {acts.length > 0 ? (
            <p className="mt-2 text-xs text-foreground/50">
              Нажмите на метку слева, чтобы отметить дело как пожирателя времени.
            </p>
          ) : null}

          <ul className="mt-2 space-y-1.5">
            {acts.map((a) => (
              <li
                key={a.id}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                  a.waster ? "bg-red-500/10" : "bg-emerald-500/[0.07]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleWaster(a.id)}
                  aria-label={a.waster ? "Пожиратель времени — сделать полезным" : "Отметить пожирателем времени"}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                    a.waster
                      ? "bg-red-500/15 text-red-600 hover:bg-red-500/25"
                      : "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25"
                  }`}
                >
                  {a.waster ? "● пожиратель" : "✓ полезное"}
                </button>
                <span className="flex-1 text-foreground/80">{a.text}</span>
                <span className="text-xs font-semibold text-foreground/50">{a.hours} ч</span>
                <button
                  type="button"
                  onClick={() => setActs((p) => p.filter((x) => x.id !== a.id))}
                  aria-label="Убрать"
                  className="text-foreground/30 transition-colors hover:text-foreground/70"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Круг дня */}
        <div className="flex flex-col items-center gap-2 justify-self-center">
          <svg viewBox="0 0 200 200" className="h-44 w-44" role="img" aria-label="Круг дня">
            {total === 0 ? (
              <circle cx={CX} cy={CY} r={RAD} className="fill-foreground/[0.05] stroke-foreground/10" strokeWidth="1" />
            ) : (
              slices.map(({ a, start, end }) => (
                <motion.path
                  key={a.id}
                  d={slicePath(start, end)}
                  className={a.waster ? "fill-red-500" : "fill-emerald-500"}
                  stroke="var(--background, #fff)"
                  strokeWidth="2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: a.waster ? 0.9 : 0.75 }}
                />
              ))
            )}
          </svg>
          <div className="text-center">
            <div className="text-sm font-bold text-red-600">{wastedPct}% времени впустую</div>
            <div className="text-xs text-foreground/50">
              потеряно {Math.round(wasted * 10) / 10} из {Math.round(total * 10) / 10} ч
            </div>
          </div>
        </div>
      </div>

      {wasted > 0 ? (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700"
        >
          {Math.round(wasted * 10) / 10} ч пожирателей в день ≈ <b>{weeksPerYear} полных рабочих недель</b> в год впустую.
          Уберите хотя бы половину — и освободите недели на важное.
        </motion.p>
      ) : (
        <p className="mt-4 text-xs text-foreground/45">
          Запишите свой день по часам и отметьте пожирателей — увидите, сколько времени утекает и во что это выливается за год.
        </p>
      )}
    </div>
  );
}
