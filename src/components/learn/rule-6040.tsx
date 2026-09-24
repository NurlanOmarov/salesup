"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeftRight,
  ArrowRight,
  Check,
  CornerUpRight,
  Plus,
  RefreshCw,
  Sun,
  X,
  Zap,
} from "lucide-react";
import type { DayTask, Rule6040Data } from "@/lib/interactive";
import { seededShuffle } from "@/lib/learn/format";
import { usePracticeDone } from "@/components/learn/practice-context";

/**
 * Правило 60/40 (уроки 09 и 14): жёстко планируем не больше 60% дня, а 40%
 * забиваем гибкими делами, которые при форс-мажоре переезжают на завтра.
 *
 * Если в данных есть pool + surprises — сначала «Прожитый день»: ученик
 * раскладывает дела на «план на сегодня» и «гибкие — если успею», затем день
 * проигрывается с форс-мажорами, и правило видно по последствиям (гибкие
 * уезжают — нормально; перегруженный план срывается; срочное в гибких — на
 * удачу). Шаг 2 — прежняя песочница со своими делами. Без pool/surprises —
 * только песочница, как раньше. Оболочка без AI-контента.
 */

const R = 70;
const CIRC = 2 * Math.PI * R;
const LIMIT = 0.6;

const EMERALD = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const VIOLET = "#8b5cf6";

function zoneColor(frac: number) {
  return frac <= LIMIT ? EMERALD : frac <= 1 ? AMBER : RED;
}

/** Часы по-русски: 1.5 → «1,5 ч». */
function fmtH(h: number) {
  return `${String(Math.round(h * 100) / 100).replace(".", ",")} ч`;
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

// Дела адресуются индексом в pool; индексы берутся только из самого pool.
const at = (pool: DayTask[], i: number) => pool[i] as DayTask;

// ─── Кольцо дня ───────────────────────────────────────────────────────────────

type Segment = { key: string; hours: number; color: string; opacity?: number };

/**
 * Кольцо дня из нескольких дуг подряд (план, гибкие, форс-мажоры), остаток —
 * свободное время. Поворот на -90° — внутри SVG (а не CSS), чтобы подписи в
 * центре не поворачивались, а метка 60% считалась в тех же координатах, что и
 * дуги: дуга начинается на 3 часах, значит 60% — это угол 216°.
 */
function DayRing({ segments, day, value, sub, valueColor }: {
  segments: Segment[];
  day: number;
  value: string;
  sub: string;
  valueColor: string;
}) {
  const reduce = useReducedMotion();
  const transition = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 120, damping: 20 };
  let start = 0;
  const arcs = segments.map((s) => {
    // Дуги не выходят за полный круг, даже если дел больше, чем часов в дне.
    const from = Math.min(start, day);
    const len = Math.max(0, Math.min(s.hours, day - from));
    start += s.hours;
    return { ...s, off: (from / day) * CIRC, len: (len / day) * CIRC };
  });
  const a = LIMIT * 2 * Math.PI;
  const mark = (r: number) => ({ x: 90 + r * Math.cos(a), y: 90 + r * Math.sin(a) });
  const m1 = mark(R - 12);
  const m2 = mark(R + 12);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 180 180" className="h-44 w-44" role="img" aria-label={`Кольцо дня: ${value}, ${sub}`}>
        <g transform="rotate(-90 90 90)">
          <circle cx="90" cy="90" r={R} fill="none" stroke="currentColor" strokeWidth="16" className="text-foreground/10" />
          {arcs.map((s) => (
            <motion.circle
              key={s.key}
              cx="90"
              cy="90"
              r={R}
              fill="none"
              strokeWidth="16"
              initial={false}
              animate={{
                strokeDasharray: `${s.len} ${CIRC}`,
                strokeDashoffset: -s.off,
                stroke: s.color,
                opacity: s.opacity ?? 1,
              }}
              transition={transition}
            />
          ))}
          {/* метка 60% */}
          <line x1={m1.x} y1={m1.y} x2={m2.x} y2={m2.y} stroke="currentColor" strokeWidth="3" className="text-foreground/45" />
        </g>
        <text x="90" y="92" textAnchor="middle" fontSize="24" fontWeight="700" fill={valueColor}>
          {value}
        </text>
        <text x="90" y="112" textAnchor="middle" fontSize="11" fill="currentColor" className="text-foreground/55">
          {sub}
        </text>
      </svg>
      <span className="text-[11px] font-medium text-foreground/45">метка — предел 60%</span>
    </div>
  );
}

function Legend({ items }: { items: { color: string; opacity?: number; label: string }[] }) {
  return (
    <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-foreground/60">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1">
          <span className="size-2.5 rounded-full" style={{ background: i.color, opacity: i.opacity ?? 1 }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

// ─── Проигрывание дня (чистая функция: её же проверяем тестом) ────────────────

export type DayEvent = {
  /** null — день не вмещал план ещё до форс-мажоров. */
  surprise: { text: string; hours: number } | null;
  /** Сколько свободного времени съел форс-мажор. */
  freeUsed: number;
  /** Гибкие, уехавшие на завтра (индексы pool). */
  moved: number[];
  /** Дела плана, которые сорвались (индексы pool). */
  cut: number[];
};

/**
 * Форс-мажор сначала занимает свободное время, потом вытесняет гибкие дела с
 * конца полосы (они уезжают на завтра — так и задумано), и только если места
 * всё ещё нет — срываются дела плана, тоже с конца. Порядок в полосе — порядок,
 * в котором ученик их туда положил.
 */
export function liveDay(
  day: number,
  hours: (i: number) => number,
  firm: number[],
  flex: number[],
  surprises: { text: string; hours: number }[],
): DayEvent[] {
  const f = [...firm];
  const x = [...flex];
  let free = day - sum(f.map(hours)) - sum(x.map(hours));
  const makeRoom = (need: number) => {
    const moved: number[] = [];
    const cut: number[] = [];
    while (free < need && x.length) {
      const i = x.pop()!;
      free += hours(i);
      moved.push(i);
    }
    while (free < need && f.length) {
      const i = f.pop()!;
      free += hours(i);
      cut.push(i);
    }
    return { moved, cut };
  };
  const events: DayEvent[] = [];
  if (free < 0) events.push({ surprise: null, freeUsed: 0, ...makeRoom(0) });
  for (const s of surprises) {
    const freeUsed = Math.min(Math.max(0, free), s.hours);
    const room = makeRoom(s.hours);
    free = Math.max(0, free - s.hours);
    events.push({ surprise: s, freeUsed, ...room });
  }
  return events;
}

// ─── Точка входа ──────────────────────────────────────────────────────────────

export function Rule6040({ data }: { data: Rule6040Data }) {
  if (data.pool?.length && data.surprises?.length) {
    return <LivedDay data={data} pool={data.pool} surprises={data.surprises} />;
  }
  return <Sandbox data={data} report />;
}

// ─── Шаг 1: «Прожитый день» ───────────────────────────────────────────────────

type Lane = "firm" | "flex";
type Phase = "plan" | "live" | "result" | "sandbox";

function LivedDay({ data, pool, surprises }: {
  data: Rule6040Data;
  pool: DayTask[];
  surprises: { text: string; hours: number }[];
}) {
  const reduce = useReducedMotion();
  const day = data.dayHours;
  // Номер прогона: «Спланировать заново» перемешивает дела по-новому.
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>("plan");
  // Порядок добавления важен: форс-мажор вытесняет дела с конца полосы.
  const [placed, setPlaced] = useState<{ i: number; lane: Lane }[]>([]);
  const [shown, setShown] = useState(0);

  const order = useMemo(
    () => seededShuffle(pool.map((_, i) => i), `rule6040#${attempt}`),
    [pool, attempt],
  );
  const { firm, flex } = useMemo(
    () => ({
      firm: placed.filter((p) => p.lane === "firm").map((p) => p.i),
      flex: placed.filter((p) => p.lane === "flex").map((p) => p.i),
    }),
    [placed],
  );
  const left = order.filter((i) => !placed.some((p) => p.i === i));
  const h = (i: number) => at(pool, i).hours;
  const firmH = sum(firm.map(h));
  const flexH = sum(flex.map(h));
  const firmFrac = firmH / day;
  const firmPct = Math.round(firmFrac * 100);

  const events = useMemo(
    () => (phase === "plan" ? [] : liveDay(day, (i) => at(pool, i).hours, firm, flex, surprises)),
    [phase, firm, flex, day, pool, surprises],
  );
  const seen = events.slice(0, shown);
  const moved = new Set(seen.flatMap((e) => e.moved));
  const cut = new Set(seen.flatMap((e) => e.cut));
  const surpriseH = sum(seen.map((e) => e.surprise?.hours ?? 0));

  // Итог дня — по всем событиям, а не по показанным.
  const allMoved = new Set(events.flatMap((e) => e.moved));
  const allCut = new Set(events.flatMap((e) => e.cut));
  const riskyFlex = flex.filter((i) => at(pool, i).important);
  const success = phase !== "plan" && allCut.size === 0 && riskyFlex.length === 0;
  const score = success ? (firmFrac <= LIMIT ? 100 : 70) : 0;
  usePracticeDone("RULE_6040", (phase === "result" || phase === "sandbox") && success, score);

  // Форс-мажоры прилетают по одному, чтобы было видно, что каждый вытеснил.
  const delay = reduce ? 700 : 1500;
  useEffect(() => {
    if (phase !== "live") return;
    const t = setTimeout(
      () => (shown >= events.length ? setPhase("result") : setShown((s) => s + 1)),
      shown === 0 ? 500 : delay,
    );
    return () => clearTimeout(t);
  }, [phase, shown, events.length, delay]);

  const put = (i: number, lane: Lane) => setPlaced((p) => [...p.filter((x) => x.i !== i), { i, lane }]);
  const unplace = (i: number) => setPlaced((p) => p.filter((x) => x.i !== i));
  const restart = () => {
    setAttempt((a) => a + 1);
    setPlaced([]);
    setShown(0);
    setPhase("plan");
  };

  if (phase === "sandbox") {
    return (
      <div className="space-y-3">
        <Sandbox data={data} report={false} step2 />
        <button
          type="button"
          onClick={restart}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/55 transition-colors hover:text-foreground/80"
        >
          <RefreshCw className="size-3.5" />
          Пройти «Прожитый день» заново
        </button>
      </div>
    );
  }

  const planning = phase === "plan";
  const firmNow = sum(firm.filter((i) => !cut.has(i)).map(h));
  const flexNow = sum(flex.filter((i) => !moved.has(i)).map(h));
  const color = zoneColor(firmFrac);
  const ringSegments: Segment[] = [
    { key: "firm", hours: planning ? firmH : firmNow, color },
    { key: "flex", hours: planning ? flexH : flexNow, color, opacity: 0.35 },
    { key: "surprise", hours: planning ? 0 : surpriseH, color: VIOLET },
  ];
  const freeH = Math.max(0, day - ringSegments.reduce((s, x) => s + x.hours, 0));

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-4 sm:p-6">
      <h3 className="font-bold">{data.title}</h3>
      <p className="mt-1 text-sm text-foreground/65">{data.prompt}</p>

      <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="min-w-0 space-y-4">
          {planning ? (
            <div>
              <p className="text-xs font-medium text-foreground/55">
                {left.length
                  ? `Куда это дело? Осталось разложить: ${left.length}`
                  : "Все дела разложены — можно проживать день."}
              </p>
              <ul className="mt-2 space-y-2">
                <AnimatePresence initial={false}>
                  {left.map((i) => (
                    <motion.li
                      key={i}
                      layout={!reduce}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3"
                    >
                      <div className="flex items-start gap-2">
                        <span className="min-w-0 flex-1 text-sm text-foreground/85">{at(pool, i).text}</span>
                        <span className="shrink-0 text-xs font-semibold text-foreground/50">{fmtH(at(pool, i).hours)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => put(i, "firm")}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                        >
                          В план на сегодня
                        </button>
                        <button
                          type="button"
                          onClick={() => put(i, "flex")}
                          className="rounded-lg border border-emerald-600/40 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/10"
                        >
                          В гибкие
                        </button>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <LaneBox
              title="План на сегодня"
              caption={`${fmtH(firmH)} · ${firmPct}% дня`}
              captionColor={color}
              items={firm}
              pool={pool}
              planning={planning}
              moved={moved}
              cut={cut}
              empty="Дела, которые нужно сделать именно сегодня"
              onSwap={(i) => put(i, "flex")}
              onRemove={unplace}
            />
            <LaneBox
              title="Гибкие — если успею"
              caption={fmtH(flexH)}
              items={flex}
              pool={pool}
              planning={planning}
              moved={moved}
              cut={cut}
              empty="Дела, которые могут переехать на завтра"
              onSwap={(i) => put(i, "firm")}
              onRemove={unplace}
            />
          </div>

          {!planning ? (
            <ul className="space-y-1.5" aria-live="polite">
              <AnimatePresence initial={false}>
                {seen.map((e, k) => (
                  <EventRow key={k} e={e} pool={pool} />
                ))}
              </AnimatePresence>
            </ul>
          ) : null}
        </div>

        <div className="flex flex-col items-center gap-2 justify-self-center">
          <DayRing
            segments={ringSegments}
            day={day}
            value={`${firmPct}%`}
            sub={`план: ${fmtH(firmH)} из ${day}`}
            valueColor={color}
          />
          <Legend
            items={[
              { color, label: "План" },
              { color, opacity: 0.35, label: "Гибкие" },
              ...(planning ? [] : [{ color: VIOLET, label: "Форс-мажор" }]),
              { color: "rgb(128 128 128 / .25)", label: `Свободно ${fmtH(freeH)}` },
            ]}
          />
        </div>
      </div>

      {planning ? (
        <>
          {firmFrac > LIMIT ? (
            <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-800">
              План занял {firmPct}% дня — больше 60%. Если прилетит срочное, сдвигать будет нечего, кроме плана.
            </p>
          ) : null}
          <button
            type="button"
            disabled={left.length > 0}
            onClick={() => {
              setShown(0);
              setPhase("live");
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sun className="size-4" />
            Прожить день
          </button>
        </>
      ) : null}

      {phase === "result" ? (
        <DayResult
          pool={pool}
          firm={firm}
          flex={flex}
          allMoved={allMoved}
          allCut={allCut}
          success={success}
          score={score}
          firmPct={firmPct}
          onRetry={restart}
          onNext={() => setPhase("sandbox")}
        />
      ) : null}
    </div>
  );
}

function LaneBox({ title, caption, captionColor, items, pool, planning, moved, cut, empty, onSwap, onRemove }: {
  title: string;
  caption: string;
  captionColor?: string;
  items: number[];
  pool: DayTask[];
  planning: boolean;
  moved: Set<number>;
  cut: Set<number>;
  empty: string;
  onSwap: (i: number) => void;
  onRemove: (i: number) => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="min-w-0 rounded-xl border border-foreground/10 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-xs font-bold text-foreground/75">{title}</span>
        <span className="text-[11px] font-semibold" style={captionColor ? { color: captionColor } : undefined}>
          {caption}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-foreground/40">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((i) => {
            const isMoved = moved.has(i);
            const isCut = cut.has(i);
            return (
              <motion.li
                key={i}
                layout={!reduce}
                animate={isCut && !reduce ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
                transition={{ duration: 0.45 }}
                className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
                  isCut
                    ? "bg-rose-500/10 text-rose-700"
                    : isMoved
                      ? "bg-amber-500/10 text-amber-800"
                      : "bg-foreground/[0.04] text-foreground/80"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className={isCut ? "line-through" : undefined}>{at(pool, i).text}</span>
                  {isMoved ? <span className="font-semibold"> → на завтра</span> : null}
                  {isCut ? <span className="font-semibold"> — сорвалось</span> : null}
                </span>
                <span className="shrink-0 font-semibold opacity-60">{fmtH(at(pool, i).hours)}</span>
                {planning ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onSwap(i)}
                      aria-label="В другую полосу"
                      title="В другую полосу"
                      className="shrink-0 text-foreground/35 transition-colors hover:text-foreground/70"
                    >
                      <ArrowLeftRight className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(i)}
                      aria-label="Вернуть в список"
                      title="Вернуть в список"
                      className="shrink-0 text-foreground/35 transition-colors hover:text-foreground/70"
                    >
                      <X className="size-3.5" />
                    </button>
                  </>
                ) : null}
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EventRow({ e, pool }: { e: DayEvent; pool: DayTask[] }) {
  const names = (xs: number[]) => xs.map((i) => `«${at(pool, i).text}»`).join(", ");
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-violet-500/25 bg-violet-500/[0.06] px-3 py-2 text-xs"
    >
      <div className="flex items-start gap-1.5 font-semibold text-violet-700">
        <Zap className="mt-px size-3.5 shrink-0" />
        <span className="min-w-0">
          {e.surprise ? `Прилетело: ${e.surprise.text} (${fmtH(e.surprise.hours)})` : "Дел больше, чем часов в дне"}
        </span>
      </div>
      <div className="mt-1 space-y-0.5 pl-5 text-foreground/70">
        {e.freeUsed > 0 ? <p>Заняло свободное время ({fmtH(e.freeUsed)}).</p> : null}
        {e.moved.length ? (
          <p className="text-amber-800">На завтра: {names(e.moved)} — для гибких это нормально.</p>
        ) : null}
        {e.cut.length ? <p className="font-semibold text-rose-700">Сорвалось из плана: {names(e.cut)}.</p> : null}
        {!e.moved.length && !e.cut.length && e.surprise ? <p>План не тронут.</p> : null}
      </div>
    </motion.li>
  );
}

function DayResult({ pool, firm, flex, allMoved, allCut, success, score, firmPct, onRetry, onNext }: {
  pool: DayTask[];
  firm: number[];
  flex: number[];
  allMoved: Set<number>;
  allCut: Set<number>;
  success: boolean;
  score: number;
  firmPct: number;
  onRetry: () => void;
  onNext: () => void;
}) {
  // Что пошло не так — по уроку: срочное не место в гибких, а перегруженный план срывается.
  const problems: { key: string; title: string; why?: string }[] = [];
  for (const i of flex) {
    if (!at(pool, i).important) continue;
    problems.push({
      key: `f${i}`,
      title: allMoved.has(i)
        ? `Срочное уехало на завтра: «${at(pool, i).text}»`
        : `Срочное оставили на удачу: «${at(pool, i).text}» — сегодня его не вытеснило, но в гибких гарантии нет`,
      why: at(pool, i).why,
    });
  }
  for (const i of firm) {
    if (!allCut.has(i)) continue;
    problems.push({
      key: `c${i}`,
      title: `План развалился: «${at(pool, i).text}» сорвалось — план занимал ${firmPct}% дня`,
      why: at(pool, i).important ? at(pool, i).why : "Это дело могло подождать, но вы пообещали его на сегодня — и не сделали.",
    });
  }
  // Гибкое в плане — само по себе не ошибка, но разберём, почему оно гибкое.
  const notes = firm.filter((i) => !at(pool, i).important && !allCut.has(i));

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-3">
      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          success
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800"
            : "border-rose-500/30 bg-rose-500/10 text-rose-800"
        }`}
      >
        <p className="font-bold">
          {success
            ? score === 100
              ? "День прожит: всё срочное сделано, форс-мажоры забрали только гибкие дела."
              : `Всё срочное сделано — но повезло: план занимал ${firmPct}% дня, запаса почти не было.`
            : "День не удался: срочное на сегодня не сделано."}
        </p>
        {problems.length ? (
          <ul className="mt-2 space-y-1.5">
            {problems.map((p) => (
              <li key={p.key}>
                <p className="font-semibold">{p.title}</p>
                {p.why ? <p className="text-xs opacity-80">{p.why}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {notes.length ? (
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3 text-xs text-foreground/70">
          <p className="font-semibold text-foreground/80">Эти дела можно было отправить в гибкие:</p>
          <ul className="mt-1 space-y-1">
            {notes.map((i) => (
              <li key={i}>
                «{at(pool, i).text}» — {at(pool, i).why ?? "срока «именно сегодня» у него нет."}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 text-sm text-foreground/80">
        <p className="font-semibold">Правило 60/40</p>
        <p className="mt-1">
          60% дня — дела, которые нужно сделать именно сегодня. Оставшиеся 40% не оставляйте пустыми: забейте их
          гибкими делами. Прилетело срочное совещание, вызвали к руководству, позвонил клиент — гибкие переезжают на
          завтра, а план стоит. Никто не вызвал — отлично, гибкие сделаны заранее.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {success ? (
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
          >
            Шаг 2: свой день
            <ArrowRight className="size-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRetry}
          className={
            success
              ? "inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-4 py-2 text-sm font-semibold text-foreground/70 transition-colors hover:bg-foreground/5"
              : "inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
          }
        >
          {success ? <RefreshCw className="size-4" /> : <CornerUpRight className="size-4" />}
          {success ? "Пройти заново" : "Спланировать заново"}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Песочница: свои дела (шаг 2 или весь тренажёр без pool) ──────────────────

type Task = { id: number; text: string; hours: number; urgent?: boolean };

/**
 * Ученик добавляет свои дела с длительностью, кольцо дня заполняется; кнопка
 * «Прилетело срочное» показывает, зачем нужен резерв: при заполнении ≤60%
 * срочное влезает, при перегрузе — день лопается. report=false — когда
 * засчитывает «Прожитый день», а песочница только для себя.
 */
function Sandbox({ data, report, step2 = false }: { data: Rule6040Data; report: boolean; step2?: boolean }) {
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

  const zone = frac <= LIMIT ? "ok" : frac <= 1 ? "warn" : "over";
  const color = zoneColor(frac);
  // Засчитываем свой план: добавлено своё дело, и день уложен в 60% с буфером.
  const ownTasks = tasks.length - (data.seedTasks?.length ?? 0);
  usePracticeDone("RULE_6040", report && ownTasks >= 1 && zone === "ok");

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
    <div className="rounded-2xl border border-foreground/10 bg-background p-4 sm:p-6">
      {step2 ? (
        <>
          <h3 className="font-bold">Шаг 2. Ваш день</h3>
          <p className="mt-1 text-sm text-foreground/65">
            Впишите свои дела на сегодня и проверьте: план укладывается в 60%? Нажмите «Прилетело срочное» — выдержит ли
            день.
          </p>
        </>
      ) : (
        <>
          <h3 className="font-bold">{data.title}</h3>
          <p className="mt-1 text-sm text-foreground/65">{data.prompt}</p>
        </>
      )}

      <div className="mt-5 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="min-w-0">
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
              className="w-full min-w-0 rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-brand"
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
                <span className="min-w-0 flex-1 text-foreground/80">{t.text}</span>
                <span className="shrink-0 text-xs font-semibold text-foreground/50">{fmtH(t.hours)}</span>
                <button
                  type="button"
                  onClick={() => setTasks((p) => p.filter((x) => x.id !== t.id))}
                  aria-label="Убрать"
                  className="shrink-0 text-foreground/30 transition-colors hover:text-foreground/70"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="justify-self-center">
          <DayRing
            segments={[{ key: "all", hours: total, color }]}
            day={day}
            value={`${pct}%`}
            sub={`${fmtH(total)} из ${day} ч`}
            valueColor={color}
          />
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
        {zone === "ok" ? <Check className="mr-1 inline size-4 align-[-3px]" /> : null}
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
