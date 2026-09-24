"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useAnimationControls, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Plus, RotateCcw, X } from "lucide-react";
import type { TimeAuditData, TimeAuditEvent, TimeEventKind } from "@/lib/interactive";
import { usePracticeDone } from "@/components/learn/practice-context";

/**
 * Хронометраж / пожиратели времени (урок 13). Если в данных есть лента дня
 * (`events`), первый шаг — «Честный хронометраж»: события дня менеджера идут по
 * часам, ученик относит каждое к работе, нормальному перерыву или пожирателю.
 * Промах — строка отскакивает с объяснением из урока; круг дня закрашивается по
 * ВЕРНЫМ видам, так что в конце видно, куда на самом деле ушёл день, и это
 * сравнивается с «60/20/20» из урока. Второй шаг — свой день (часы + пометка
 * пожирателей). Без `events` — только свой день, как раньше.
 * Оболочка без AI-контента и без сохранения.
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

/**
 * Сектор круга. Дуга с совпадающими концами (ровно 360°) не рисуется вовсе,
 * поэтому единственный сектор на весь круг рисуем окружностью.
 */
function Slice({ start, end, cls, opacity }: { start: number; end: number; cls: string; opacity: number }) {
  const full = end - start >= 359.99;
  return full ? (
    <motion.circle
      cx={CX}
      cy={CY}
      r={RAD}
      className={cls}
      initial={{ opacity: 0 }}
      animate={{ opacity }}
    />
  ) : (
    <motion.path
      d={slicePath(start, end)}
      className={cls}
      stroke="var(--background, #fff)"
      strokeWidth="2"
      strokeLinejoin="round"
      initial={{ opacity: 0 }}
      animate={{ opacity }}
    />
  );
}

const KINDS: { kind: TimeEventKind; label: string; fill: string; dot: string; chip: string; btn: string }[] = [
  {
    kind: "work",
    label: "Работа",
    fill: "fill-emerald-500",
    dot: "bg-emerald-500",
    chip: "bg-emerald-500/15 text-emerald-700",
    btn: "border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10",
  },
  {
    kind: "break",
    label: "Перерыв",
    fill: "fill-amber-400",
    dot: "bg-amber-400",
    chip: "bg-amber-500/15 text-amber-800",
    btn: "border-amber-500/40 text-amber-800 hover:bg-amber-500/10",
  },
  {
    kind: "waster",
    label: "Пожиратель",
    fill: "fill-red-500",
    dot: "bg-red-500",
    chip: "bg-red-500/15 text-red-600",
    btn: "border-red-500/40 text-red-600 hover:bg-red-500/10",
  },
];
const kindOf = (k: TimeEventKind) => KINDS.find((x) => x.kind === k)!;

export function TimeAudit({ data }: { data: TimeAuditData }) {
  const events = data.events;
  const [step, setStep] = useState<"tape" | "own">(events ? "tape" : "own");
  const [attempt, setAttempt] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const [ownDone, setOwnDone] = useState(false);

  // С лентой дня засчитывается именно она (проверяемый раунд), иначе — свой день.
  const done = events ? score !== null : ownDone;
  usePracticeDone("TIME_AUDIT", done, events ? score : undefined);

  function restart() {
    setScore(null);
    setAttempt((a) => a + 1);
    setStep("tape");
  }

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-6">
      <h3 className="font-bold">{data.title}</h3>
      <p className="mt-1 text-sm text-foreground/65">{data.prompt}</p>

      {events ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
            {step === "tape" ? "Шаг 1 из 2 · Честный хронометраж" : "Шаг 2 из 2 · Свой день"}
          </span>
          {step === "own" ? (
            <button
              type="button"
              onClick={restart}
              className="flex items-center gap-1 text-xs font-medium text-foreground/50 transition-colors hover:text-foreground/80"
            >
              <RotateCcw className="size-3.5" /> Пройти ленту дня заново
            </button>
          ) : null}
        </div>
      ) : null}

      {events && step === "tape" ? (
        <Tape
          key={attempt}
          events={events}
          finished={score !== null}
          onFinish={setScore}
          onRestart={restart}
          onNext={() => setStep("own")}
        />
      ) : (
        <OwnDay seed={data.seedActivities ?? []} onDoneChange={setOwnDone} />
      )}
    </div>
  );
}

// ─── Шаг 1: лента дня менеджера, с проверкой ──────────────────────────────────

/** Начало рабочего дня из урока: «вы работаете с 8:30». */
const DAY_START = 8 * 60 + 30;
const clock = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;

type Feedback = { ok: boolean; pick: TimeEventKind; idx: number; n: number };

function Tape({
  events,
  finished,
  onFinish,
  onRestart,
  onNext,
}: {
  events: TimeAuditEvent[];
  finished: boolean;
  onFinish: (score: number) => void;
  onRestart: () => void;
  onNext: () => void;
}) {
  const reduce = useReducedMotion();
  const shake = useAnimationControls();
  const [pos, setPos] = useState(0);
  const [missed, setMissed] = useState<number[]>([]);
  const [fb, setFb] = useState<Feedback | null>(null);

  const total = events.reduce((s, e) => s + e.minutes, 0);
  // Время начала каждого события — лента идёт подряд с начала дня.
  const starts = events.map((_, i) => DAY_START + events.slice(0, i).reduce((s, e) => s + e.minutes, 0));
  const cur = pos < events.length ? events[pos]! : null;

  function pick(kind: TimeEventKind, at: number) {
    // Уезжающая карточка (exit-анимация) ещё кликабельна — её клики игнорируем.
    if (!cur || at !== pos) return;
    const n = (fb?.n ?? 0) + 1;
    if (kind === cur.kind) {
      setFb({ ok: true, pick: kind, idx: pos, n });
      setPos(pos + 1);
      if (pos + 1 >= events.length) {
        onFinish(Math.round(((events.length - missed.length) / events.length) * 100));
      }
      return;
    }
    // Балл — по первой попытке: промах засчитываем один раз на событие.
    if (!missed.includes(pos)) setMissed([...missed, pos]);
    setFb({ ok: false, pick: kind, idx: pos, n });
    void shake.start(
      reduce
        ? { opacity: [1, 0.55, 1], transition: { duration: 0.35 } }
        : { x: [0, -14, 12, -8, 6, -3, 0], transition: { duration: 0.45 } },
    );
  }

  // Круг дня: разобранные события по верному виду, в порядке ленты; остальное —
  // серый фон («ещё не учтено»).
  let acc = 0;
  const slices = events.slice(0, pos).map((e, i) => {
    const start = (acc / total) * 360;
    acc += e.minutes;
    return { i, e, start, end: (acc / total) * 360 };
  });
  const sum = (k: TimeEventKind) => events.filter((e) => e.kind === k).reduce((s, e) => s + e.minutes, 0);
  const fbEvent = fb ? events[fb.idx]! : null;

  return (
    <div className="mt-3 grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground/55">
          Рабочий день менеджера по часам. Что это было — работа, нормальный перерыв или пожиратель?
        </p>

        {/* Лента: уже разобранные события */}
        <ol className="mt-2 space-y-1">
          {events.slice(0, pos).map((e, i) => {
            const k = kindOf(e.kind);
            return (
              <motion.li
                key={i}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 30 }}
                className="flex items-baseline gap-2 rounded-lg bg-foreground/[0.03] px-2.5 py-1.5 text-xs"
              >
                <span className="w-9 shrink-0 tabular-nums text-foreground/45">{clock(starts[i]!)}</span>
                <span className="min-w-0 flex-1 text-foreground/75">{e.text}</span>
                <span className="shrink-0 tabular-nums text-foreground/45">{e.minutes} мин</span>
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${k.chip}`}>
                  {k.label}
                </span>
              </motion.li>
            );
          })}
        </ol>

        {/* Текущее событие */}
        {cur ? (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={pos}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="mt-2"
            >
              <motion.div
                animate={shake}
                className="rounded-xl border border-brand/40 bg-background p-3 shadow-sm"
              >
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="shrink-0 tabular-nums font-semibold text-brand">{clock(starts[pos]!)}</span>
                  <span className="min-w-0 flex-1 font-medium text-foreground/90">{cur.text}</span>
                  <span className="shrink-0 tabular-nums text-xs text-foreground/50">{cur.minutes} мин</span>
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                  {KINDS.map((k) => (
                    <button
                      key={k.kind}
                      type="button"
                      onClick={() => pick(k.kind, pos)}
                      className={`rounded-lg border px-1 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${k.btn}`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        ) : null}

        {cur ? (
          <p className="mt-1.5 text-[11px] text-foreground/45 tabular-nums">
            Событие {pos + 1} из {events.length}
          </p>
        ) : null}

        {/* Обратная связь по последнему ходу */}
        <AnimatePresence mode="wait" initial={false}>
          {fb && fbEvent && !finished ? (
            <motion.div
              key={fb.n}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              className={`mt-2 flex gap-2 rounded-xl border px-3 py-2 text-sm ${
                fb.ok
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-800"
              }`}
            >
              {fb.ok ? <Check className="mt-0.5 size-4 shrink-0" /> : <X className="mt-0.5 size-4 shrink-0" />}
              <p className="min-w-0">
                {fb.ok ? (
                  <>
                    <b>{fbEvent.text}</b> — {fbEvent.why}
                  </>
                ) : (
                  <>
                    <b>Не «{kindOf(fb.pick).label.toLowerCase()}».</b> {fbEvent.why} Попробуйте ещё раз.
                  </>
                )}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Круг дня: закрашивается по мере разбора */}
      <div className="row-start-1 flex flex-col items-center gap-2 justify-self-center sm:row-start-auto">
        <svg viewBox="0 0 200 200" className="h-40 w-40 sm:h-44 sm:w-44" role="img" aria-label="Круг рабочего дня">
          <circle cx={CX} cy={CY} r={RAD} className="fill-foreground/[0.05] stroke-foreground/10" strokeWidth="1" />
          {slices.map(({ i, e, start, end }) => (
            <Slice key={i} start={start} end={end} cls={kindOf(e.kind).fill} opacity={e.kind === "waster" ? 0.9 : 0.8} />
          ))}
        </svg>
        <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-foreground/60">
          {KINDS.map((k) => (
            <li key={k.kind} className="flex items-center gap-1">
              <span className={`inline-block size-2.5 rounded-full ${k.dot}`} />
              {k.label}
            </li>
          ))}
        </ul>
        <div className="text-xs tabular-nums text-foreground/50">
          учтено {slices.reduce((s, x) => s + x.e.minutes, 0)} из {total} мин
        </div>
      </div>

      {finished ? (
        <TapeSummary
          className="sm:col-span-2"
          total={total}
          work={sum("work")}
          rest={sum("break")}
          waste={sum("waster")}
          right={events.length - missed.length}
          count={events.length}
          onRestart={onRestart}
          onNext={onNext}
        />
      ) : null}
    </div>
  );
}

function TapeSummary({
  className,
  total,
  work,
  rest,
  waste,
  right,
  count,
  onRestart,
  onNext,
}: {
  className?: string;
  total: number;
  work: number;
  rest: number;
  waste: number;
  right: number;
  count: number;
  onRestart: () => void;
  onNext: () => void;
}) {
  const pct = (m: number) => Math.round((m / total) * 100);
  const rows: { label: string; min: number; bar: string; lesson: string }[] = [
    { label: "Работа", min: work, bar: "bg-emerald-500", lesson: "в уроке: 60% в лучшем случае" },
    { label: "Перерывы", min: rest, bar: "bg-amber-400", lesson: "5 минут в час — норма" },
    { label: "Пожиратели", min: waste, bar: "bg-red-500", lesson: "в уроке: 20%" },
  ];
  const wastePct = pct(waste);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 ${className ?? ""}`}
    >
      <p className="text-sm font-bold">
        С первой попытки: {right} из {count} ({Math.round((right / count) * 100)}%)
      </p>

      <p className="mt-3 text-xs font-medium text-foreground/55">Куда ушёл день ({total} мин):</p>
      <ul className="mt-1.5 space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="font-medium text-foreground/80">
                {r.label}: {r.min} мин · {pct(r.min)}%
              </span>
              <span className="text-[11px] text-foreground/45">{r.lesson}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-foreground/[0.06]">
              <motion.div
                className={`h-full rounded-full ${r.bar}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct(r.min)}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 22 }}
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-sm text-foreground/75">
        {wastePct > 20
          ? `Пожиратели съели ${wastePct}% дня — больше 20%, о которых говорит урок. `
          : `Пожиратели — ${wastePct}% дня, в пределах 20% из урока. `}
        А ещё в уроке, когда день записывают честно, 20% времени оказывается вообще не учтено — поэтому записывать
        нужно всё.
      </p>

      <ul className="mt-3 space-y-1 text-sm text-foreground/75">
        <li>— Записывайте всё, что занимает от 5 минут: кофе, разговор, письмо, даже недозвон.</li>
        <li>— Перерыв по 5 минут в час — норма, а не пожиратель.</li>
        <li>— Незнание инструмента — тоже пожиратель: три часа на формулу в Excel вместо 20 минут.</li>
        <li>— Одного дня мало: ведите хронометраж хотя бы месяц — тогда видно, куда уходит время.</li>
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
        >
          Записать свой день <ArrowRight className="size-4" />
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="flex items-center gap-1.5 rounded-lg border border-foreground/15 px-4 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
        >
          <RotateCcw className="size-4" /> Пройти заново
        </button>
      </div>
    </motion.div>
  );
}

// ─── Шаг 2 (или единственный): свой день ─────────────────────────────────────

function OwnDay({
  seed,
  onDoneChange,
}: {
  seed: { text: string; hours: number; waster: boolean }[];
  onDoneChange: (done: boolean) => void;
}) {
  const nextId = useRef(0);
  const [acts, setActs] = useState<Act[]>(() =>
    seed.map((a) => ({ id: nextId.current++, text: a.text, hours: a.hours, waster: a.waster })),
  );
  const [draft, setDraft] = useState("");
  const [hours, setHours] = useState(1);

  const total = acts.reduce((s, a) => s + a.hours, 0);
  const wasted = acts.filter((a) => a.waster).reduce((s, a) => s + a.hours, 0);
  const wastedPct = total > 0 ? Math.round((wasted / total) * 100) : 0;
  // Засчитываем свой хронометраж: добавлено своё занятие и найден хотя бы один пожиратель.
  const ownActs = acts.length - seed.length;
  const done = ownActs >= 1 && acts.some((a) => a.waster);
  useEffect(() => onDoneChange(done), [done, onDoneChange]);

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

  const toggleWaster = (id: number) => setActs((p) => p.map((a) => (a.id === id ? { ...a, waster: !a.waster } : a)));

  return (
    <>
      <div className="mt-5 grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
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
              className="w-full min-w-0 rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-brand"
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
                <span className="min-w-0 flex-1 text-foreground/80">{a.text}</span>
                <span className="shrink-0 text-xs font-semibold text-foreground/50">{a.hours} ч</span>
                <button
                  type="button"
                  onClick={() => setActs((p) => p.filter((x) => x.id !== a.id))}
                  aria-label="Убрать"
                  className="shrink-0 text-foreground/30 transition-colors hover:text-foreground/70"
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
                <Slice
                  key={a.id}
                  start={start}
                  end={end}
                  cls={a.waster ? "fill-red-500" : "fill-emerald-500"}
                  opacity={a.waster ? 0.9 : 0.75}
                />
              ))
            )}
          </svg>
          <div className="text-center">
            <div className="text-sm font-bold text-red-600">{wastedPct}% времени — пожиратели</div>
            <div className="text-xs text-foreground/50">
              {Math.round(wasted * 10) / 10} из {Math.round(total * 10) / 10} ч
            </div>
          </div>
        </div>
      </div>

      {/* Сравнение с уроком вместо выдуманной экстраполяции: в уроке — цифры дня
          (60% на работу в лучшем случае, 20% пожиратели) и цель поднять работу до 80%. */}
      {wasted > 0 ? (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700"
        >
          Пожиратели — {wastedPct}% вашего дня{wastedPct > 20 ? ", больше 20% из урока" : ""}. Откажитесь от них, и
          на работу уйдёт не 60%, а до 80% времени. Одного дня мало — ведите хронометраж хотя бы месяц.
        </motion.p>
      ) : (
        <p className="mt-4 text-xs text-foreground/45">
          Запишите свой день по часам — всё, что занимает от 5 минут, — и отметьте пожирателей.
        </p>
      )}
    </>
  );
}
