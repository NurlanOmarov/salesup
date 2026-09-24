"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  motion,
  AnimatePresence,
  MotionConfig,
  useAnimationControls,
  useReducedMotion,
} from "framer-motion";
import { Plus, X, RotateCcw, PartyPopper, ArrowRight } from "lucide-react";
import type { ElephantSlice, MetaphorData, MetaphorVariant, MorningTask } from "@/lib/interactive";
import { usePracticeDone } from "@/components/learn/practice-context";
import { seededShuffle } from "@/lib/learn/format";

/**
 * Тренажёры-метафоры тайм-менеджмента. Ученик работает со СВОИМИ задачами,
 * анимированный SVG реагирует — интерактивная оболочка без AI-контента и без
 * сохранения (весь прогресс локальный, ПДн не собираем). Один урок может держать
 * несколько метафор — сверху переключатель.
 *
 * Механики (каждая несёт смысл правила, а не просто «ввод → заливка»):
 *  • frog — «съешь лягушку первой»: у дел есть уровень неприятности; отложишь
 *    самое противное (съешь лёгкое) — лягушка РАСТЁТ и темнеет; съешь худшее
 *    первым — быстрая победа. Учит: откладывание худшего делает его страшнее.
 *  • elephant — крупную задачу дробим на куски, силуэт заполняется.
 *  • nails — выбираем 3 главных дела, гвозди забиваются по одному.
 *
 * Если в данных урока есть готовый материал (elephant.slices, frog.tasks), первым
 * идёт ПРОВЕРЯЕМЫЙ раунд на примере из видео, а свободная песочница со своими
 * задачами становится шагом 2. «Пройдено» для урока = пройден проверяемый раунд.
 *  • Слон: из пула кусков выбрать настоящие (конкретное дело на неделю); лозунг,
 *    «всё за выходные» и пожиратели энергии отскакивают с объяснением.
 *  • Лягушка: утро менеджера — выбирать, что делать дальше; схватился за главное
 *    дело раньше лягушек — оставшиеся лягушки растут.
 */

const ACCENT: Record<MetaphorVariant, { emoji: string; label: string }> = {
  elephant: { emoji: "🐘", label: "Слон" },
  frog: { emoji: "🐸", label: "Лягушка" },
  nails: { emoji: "🔨", label: "Три гвоздя" },
};

export function MetaphorTrainer({ items }: { items: MetaphorData[] }) {
  const [active, setActive] = useState(0);
  const data = items[active] ?? items[0];
  if (!data) return null;

  return (
    // reducedMotion="user" — при системной настройке «меньше движения» framer
    // отключает сдвиги/масштаб/layout-перелёты, оставляя смену прозрачности.
    <MotionConfig reducedMotion="user">
      <div className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-6">
        {items.length > 1 ? (
          <div role="tablist" aria-label="Метафоры урока" className="mb-5 flex flex-wrap gap-2">
            {items.map((m, i) => {
              const on = i === active;
              return (
                <button
                  key={m.variant}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActive(i)}
                  className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    on ? "border-brand bg-brand text-white" : "border-foreground/15 text-foreground/70 hover:border-brand/40"
                  }`}
                >
                  <span aria-hidden>{ACCENT[m.variant].emoji}</span>
                  {ACCENT[m.variant].label}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* key — сброс локального состояния при переключении метафоры */}
        {data.variant === "frog" && data.tasks ? (
          <FrogGame key={active} data={data} tasks={data.tasks} />
        ) : data.variant === "elephant" && data.slices ? (
          <ElephantGame key={active} data={data} slices={data.slices} />
        ) : data.variant === "frog" ? (
          <FrogPanel key={active} data={data} />
        ) : (
          <AccumulatePanel key={active} data={data} />
        )}
      </div>
    </MotionConfig>
  );
}

// ─── Двухшаговая оболочка: проверяемый раунд → своя песочница ────────────────

function StepTabs({
  step,
  onStep,
  labels,
}: {
  step: 1 | 2;
  onStep: (s: 1 | 2) => void;
  labels: [string, string];
}) {
  return (
    <div role="tablist" aria-label="Шаги тренажёра" className="mt-4 flex flex-wrap gap-2">
      {labels.map((label, i) => {
        const s = (i + 1) as 1 | 2;
        const on = s === step;
        return (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onStep(s)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              on
                ? "border-foreground/80 bg-foreground text-background"
                : "border-foreground/15 text-foreground/60 hover:border-foreground/35"
            }`}
          >
            <span className="tabular-nums">{s}</span>
            <span aria-hidden className="opacity-40">·</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Итог раунда: правило урока своими словами + балл, переход к шагу 2 и «заново».
 * Балл — за первую попытку: промахи уже учтены, повторные тапы его не меняют.
 */
function RoundSummary({
  title,
  score,
  children,
  nextLabel,
  onNext,
  onRestart,
}: {
  title: string;
  score: number;
  children: ReactNode;
  nextLabel: string;
  onNext: () => void;
  onRestart: () => void;
}) {
  const good = score >= 80;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mt-5 rounded-xl border px-4 py-4 ${
        good ? "border-emerald-500/30 bg-emerald-500/[0.07]" : "border-amber-500/30 bg-amber-500/[0.07]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`flex items-center gap-2 font-bold ${good ? "text-emerald-700" : "text-amber-800"}`}>
          <PartyPopper className="size-4 shrink-0" />
          {title}
        </p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
            good ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-800"
          }`}
        >
          {score}%
        </span>
      </div>
      <div className="mt-2 space-y-1.5 text-sm text-foreground/80">{children}</div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          {nextLabel}
          <ArrowRight className="size-4" />
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/55 transition-colors hover:text-foreground/85"
        >
          <RotateCcw className="size-3.5" />
          Пройти заново
        </button>
      </div>
    </motion.div>
  );
}

/** Пояснение к последнему выбору: зелёное — верно, янтарное — промах. */
function Feedback({ fb }: { fb: { key: number; ok: boolean; text: string } | null }) {
  return (
    <div aria-live="polite" className="min-h-0">
      <AnimatePresence mode="wait" initial={false}>
        {fb ? (
          <motion.p
            key={fb.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={`mt-3 rounded-xl border px-3.5 py-2.5 text-sm ${
              fb.ok
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800"
                : "border-amber-500/35 bg-amber-500/10 text-amber-900"
            }`}
          >
            {fb.text}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Кнопка-карточка пула: при промахе «отскакивает» (толчок вперёд и назад + дрожь). */
function PoolChip({
  layoutId,
  text,
  onPick,
  disabled,
  state,
  tag,
}: {
  layoutId: string;
  text: string;
  onPick: () => boolean; // true — принято, false — отскок
  disabled: boolean;
  state: "idle" | "rejected";
  tag?: string;
}) {
  const controls = useAnimationControls();
  const reduce = useReducedMotion();
  return (
    <motion.li layoutId={layoutId} layout="position" className="list-none">
      <motion.button
        type="button"
        animate={controls}
        disabled={disabled}
        onClick={() => {
          const ok = onPick();
          if (!ok && !reduce) {
            void controls.start({
              x: [0, 14, -9, 6, -3, 0],
              transition: { duration: 0.5, ease: "easeOut" },
            });
          }
        }}
        className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
          state === "rejected"
            ? "border-amber-500/30 bg-amber-500/[0.06] text-foreground/55"
            : "border-foreground/10 bg-foreground/[0.03] text-foreground/85 hover:border-brand/40 hover:bg-brand/[0.04]"
        } disabled:cursor-default disabled:hover:border-foreground/10 disabled:hover:bg-foreground/[0.03]`}
      >
        <span className={`min-w-0 flex-1 ${state === "rejected" ? "line-through decoration-amber-600/50" : ""}`}>
          {text}
        </span>
        {tag ? (
          <span className="mt-0.5 shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            {tag}
          </span>
        ) : null}
      </motion.button>
    </motion.li>
  );
}

// ─── Слон, шаг 1: режем слона урока ──────────────────────────────────────────

function ElephantGame({ data, slices }: { data: MetaphorData; slices: ElephantSlice[] }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [attempt, setAttempt] = useState(0);
  return (
    <>
      <Header data={data} />
      <StepTabs step={step} onStep={setStep} labels={["Режем слона урока", "Свой слон"]} />
      {/* Оба шага смонтированы: переключение не сбрасывает ни раунд, ни песочницу. */}
      <div className={step === 1 ? "" : "hidden"}>
        <ElephantRound
          key={attempt}
          data={data}
          slices={slices}
          seed={`${data.title}#${attempt}`}
          onNext={() => setStep(2)}
          onRestart={() => setAttempt((a) => a + 1)}
        />
      </div>
      <div className={step === 2 ? "" : "hidden"}>
        <AccumulatePanel data={data} showHeader={false} practice={false} />
      </div>
    </>
  );
}

function ElephantRound({
  data,
  slices,
  seed,
  onNext,
  onRestart,
}: {
  data: MetaphorData;
  slices: ElephantSlice[];
  seed: string;
  onNext: () => void;
  onRestart: () => void;
}) {
  const goal = data.goal;
  // Порядок зависит только от seed — одинаков на сервере и в браузере.
  const pool = useMemo(() => seededShuffle(slices.map((s, i) => ({ ...s, id: i })), seed), [slices, seed]);
  const [eaten, setEaten] = useState<number[]>([]); // id в порядке «съедания»
  const [rejected, setRejected] = useState<number[]>([]); // ложные куски, на которые уже нажали
  const [fb, setFb] = useState<{ key: number; ok: boolean; text: string } | null>(null);

  const done = eaten.length >= goal;
  const misses = rejected.length;
  const score = Math.max(0, 100 - 20 * misses);
  usePracticeDone("TASK_METAPHOR", done, score);

  function pick(s: ElephantSlice & { id: number }): boolean {
    if (done) return true;
    if (s.ok) {
      setEaten((p) => [...p, s.id]);
      setFb({ key: s.id, ok: true, text: `Кусок отрезан. ${s.why}` });
      return true;
    }
    // Ложный кусок считается промахом один раз — балл за первую попытку.
    setRejected((p) => (p.includes(s.id) ? p : [...p, s.id]));
    setFb({ key: s.id + 1000, ok: false, text: `Не кусок. ${s.why}` });
    return false;
  }

  const byId = (id: number) => pool.find((s) => s.id === id)!;
  const left = pool.filter((s) => !eaten.includes(s.id));

  return (
    <div className="mt-5 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-start">
      <div className="min-w-0">
        <p className="text-sm text-foreground/75">
          Отрежьте от слона {goal} {plural(goal, "настоящий кусок", "настоящих куска", "настоящих кусков")}: каждый — конкретное дело на неделю. Лозунги и «всё
          сразу» не режутся.
        </p>
        {/* После финиша пул прячем: оставшиеся куски уже не нужны, смотрим итог. */}
        {!done ? (
          <>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs font-medium text-foreground/55">Что можно отрезать?</span>
              <span className="text-xs font-semibold tabular-nums text-foreground/45">
                {eaten.length} / {goal}
              </span>
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {left.map((s) => {
                const isRejected = rejected.includes(s.id);
                return (
                  <PoolChip
                    key={s.id}
                    layoutId={`${seed}-slice-${s.id}`}
                    text={s.text}
                    onPick={() => pick(s)}
                    disabled={isRejected}
                    state={isRejected ? "rejected" : "idle"}
                    tag={isRejected ? "не кусок" : undefined}
                  />
                );
              })}
            </ul>

            <Feedback fb={fb} />
          </>
        ) : null}

        {eaten.length > 0 ? (
          <div className="mt-4">
            <span className="text-xs font-medium text-foreground/55">Съедено</span>
            <ol className="mt-1.5 space-y-1.5">
              {eaten.map((id, i) => (
                <motion.li
                  key={id}
                  layoutId={`${seed}-slice-${id}`}
                  layout="position"
                  className="flex items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm"
                >
                  <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-semibold text-emerald-800">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-foreground/80">{byId(id).text}</span>
                </motion.li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>

      {/* На телефоне слон над списком — видно, как он убывает, пока выбираешь. */}
      <div className="order-first sm:order-none sm:justify-self-center">
        <VisualColumn
          variant="elephant"
          progress={Math.min(1, eaten.length / goal)}
          goal={goal}
          step={eaten.length}
          cuts={goal}
          angry={fb !== null && !fb.ok && !done}
          caption={done ? "слон съеден" : `съедено ${eaten.length} из ${goal}`}
        />
      </div>

      {done ? (
        <div className="sm:col-span-2 -mt-5">
          <RoundSummary
            title="Слон съеден по кусочкам"
            score={score}
            nextLabel="Разрезать своего слона"
            onNext={onNext}
            onRestart={onRestart}
          >
            <p>
              Огромная задача перестаёт пугать, когда её распилили: {goal} {plural(goal, "кусок", "куска", "кусков")} примерно по 5% — и каждый это конкретное дело на
              неделю. Сделали кусок — берёте следующий, и так по чуть-чуть.
            </p>
            <p className="text-foreground/60">
              {misses === 0
                ? "Ни одной ловушки: лозунги, «всё за выходные» и пожирателей энергии вы распознали сразу."
                : `Попались в ${misses} ${plural(misses, "ловушку", "ловушки", "ловушек")}: лозунг и «всё сразу» — не куски, а «это невозможно» — пожиратель энергии.`}
            </p>
          </RoundSummary>
        </div>
      ) : null}
    </div>
  );
}

// ─── Лягушка, шаг 1: утро менеджера ──────────────────────────────────────────

function FrogGame({ data, tasks }: { data: MetaphorData; tasks: MorningTask[] }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [attempt, setAttempt] = useState(0);
  return (
    <>
      <Header data={data} />
      <StepTabs step={step} onStep={setStep} labels={["Утро менеджера", "Своё утро"]} />
      <div className={step === 1 ? "" : "hidden"}>
        <FrogRound
          key={attempt}
          tasks={tasks}
          seed={`${data.title}#${attempt}`}
          onNext={() => setStep(2)}
          onRestart={() => setAttempt((a) => a + 1)}
        />
      </div>
      <div className={step === 2 ? "" : "hidden"}>
        <FrogPanel data={data} showHeader={false} practice={false} />
      </div>
    </>
  );
}

/** Русское склонение по числу: 1 кусок, 2 куска, 5 кусков. */
function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const minutesLabel = (m: number) => (m >= 60 && m % 60 === 0 ? `${m / 60} ч` : `${m} мин`);

function FrogRound({
  tasks,
  seed,
  onNext,
  onRestart,
}: {
  tasks: MorningTask[];
  seed: string;
  onNext: () => void;
  onRestart: () => void;
}) {
  const list = useMemo(() => seededShuffle(tasks.map((t, i) => ({ ...t, id: i })), seed), [tasks, seed]);
  const frogCount = list.filter((t) => t.frog).length;
  const [eaten, setEaten] = useState<number[]>([]); // съеденные лягушки по порядку
  const [postponed, setPostponed] = useState<number[]>([]); // главные дела, за которые схватились рано
  const [fb, setFb] = useState<{ key: number; ok: boolean; text: string } | null>(null);

  const done = eaten.length >= frogCount;
  const growth = postponed.length;
  const score = Math.max(0, 100 - 25 * growth);
  usePracticeDone("TASK_METAPHOR", done, score);

  function pick(t: MorningTask & { id: number }): boolean {
    if (done) return true;
    if (t.frog) {
      setEaten((p) => [...p, t.id]);
      setFb({ key: t.id, ok: true, text: `🐸 Съедена за ${minutesLabel(t.minutes)}. ${t.why}` });
      return true;
    }
    // Главное дело раньше лягушек: оно возвращается в список, а лягушки растут.
    setPostponed((p) => (p.includes(t.id) ? p : [...p, t.id]));
    setFb({ key: t.id + 1000, ok: false, text: `Лягушки подросли, пока вы взялись за это. ${t.why}` });
    return false;
  }

  const byId = (id: number) => list.find((t) => t.id === id)!;
  const bigOnes = list.filter((t) => !t.frog);
  const left = list.filter((t) => !eaten.includes(t.id));
  // Итоговый порядок дня: лягушки в том порядке, как съели, потом главное.
  const order = done ? [...eaten.map(byId), ...bigOnes] : eaten.map(byId);
  const frogMinutes = eaten.reduce((sum, id) => sum + byId(id).minutes, 0);
  // Растёт внутри своего холста: от 0.6 до 1.0 при 4+ откладываниях.
  const scale = 0.6 + Math.min(growth, 4) * 0.1;

  return (
    <div className="mt-5 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-start">
      <div className="min-w-0">
        <p className="text-sm text-foreground/75">
          Утро, список дел готов. Выбирайте, что делать сейчас, — по одному. Сначала лягушки: короткие
          неприятные дела.
        </p>
        {!done ? (
          <>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs font-medium text-foreground/55">Что делаем сейчас?</span>
              <span className="text-xs font-semibold tabular-nums text-foreground/45">
                🐸 {eaten.length} / {frogCount}
              </span>
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {left.map((t) => {
                const isPostponed = postponed.includes(t.id);
                return (
                  <PoolChip
                    key={t.id}
                    layoutId={`${seed}-task-${t.id}`}
                    text={t.text}
                    onPick={() => pick(t)}
                    disabled={isPostponed}
                    state="idle"
                    tag={isPostponed ? "после лягушек" : undefined}
                  />
                );
              })}
            </ul>
            <Feedback fb={fb} />
          </>
        ) : null}

        {order.length > 0 ? (
          <div className="mt-4">
            <span className="text-xs font-medium text-foreground/55">
              {done ? "Порядок утра" : "Сделано"}
            </span>
            <ol className="mt-1.5 space-y-1.5">
              {order.map((t, i) => (
                <motion.li
                  key={t.id}
                  layoutId={`${seed}-task-${t.id}`}
                  layout="position"
                  initial={t.frog ? { scale: 0.96 } : { opacity: 0 }}
                  animate={t.frog ? { scale: [0.96, 1.03, 1] } : { opacity: 1 }}
                  transition={{ duration: 0.35 }}
                  className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                    // Главные дела после лягушек — это правильный порядок, а не
                    // ошибка: нейтральный фон, чтобы не читалось как промах.
                    t.frog ? "bg-emerald-500/10" : "bg-foreground/[0.04]"
                  }`}
                >
                  <span
                    className={`mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      t.frog ? "bg-emerald-500/20 text-emerald-800" : "bg-foreground/10 text-foreground/60"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-foreground/80">
                    {t.frog ? <span aria-label="лягушка">🐸 </span> : null}
                    {t.text}
                  </span>
                  <span className="mt-px shrink-0 text-xs font-semibold tabular-nums text-foreground/45">
                    {minutesLabel(t.minutes)}
                  </span>
                </motion.li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>

      <div className="order-first sm:order-none sm:justify-self-center">
        <VisualColumn
          variant="frog"
          progress={frogCount ? eaten.length / frogCount : 0}
          goal={frogCount}
          step={eaten.length}
          innerScale={scale}
          angry={growth > 0 && !done}
          progressLabel={growth > 0 && !done ? `лягушки выросли ×${growth}` : undefined}
          caption={done ? "лягушки съедены" : `съедено ${eaten.length} из ${frogCount}`}
        />
      </div>

      {done ? (
        <div className="sm:col-span-2 -mt-5">
          <RoundSummary
            title="Лягушки съедены — теперь главное"
            score={score}
            nextLabel="Разобрать своё утро"
            onNext={onNext}
            onRestart={onRestart}
          >
            <p>
              «Две-три неприятных дела сделал — и занимайся главными, основными вещами». Лягушки заняли{" "}
              {minutesLabel(frogMinutes)}, а висели бы над головой весь день.
            </p>
            <p className="text-foreground/60">
              {growth === 0
                ? "Ни разу не отложили: сначала лягушки, потом главное — ровно как в уроке."
                : `Хватались за главное раньше лягушек: ${growth} ${plural(growth, "раз", "раза", "раз")}. Каждый раз оставшиеся лягушки росли.`}
            </p>
          </RoundSummary>
        </div>
      ) : null}
    </div>
  );
}

function Header({ data }: { data: MetaphorData }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-2xl" aria-hidden>
        {ACCENT[data.variant].emoji}
      </span>
      <div>
        <h3 className="font-bold">{data.title}</h3>
        <p className="mt-1 text-sm text-foreground/65">{data.prompt}</p>
      </div>
    </div>
  );
}

function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/50 transition-colors hover:text-foreground/80"
      >
        <RotateCcw className="size-3.5" />
        Сбросить
      </button>
    </div>
  );
}

// ─── Слон / Гвозди: «накопить до цели» ───────────────────────────────────────

/**
 * showHeader=false и practice=false — когда панель служит шагом 2 после
 * проверяемого раунда: заголовок уже над шагами, а «пройдено» сообщает раунд.
 */
function AccumulatePanel({
  data,
  showHeader = true,
  practice = true,
}: {
  data: MetaphorData;
  showHeader?: boolean;
  practice?: boolean;
}) {
  const [bigTask, setBigTask] = useState("");
  const [entries, setEntries] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  const goal = data.goal;
  const capped = entries.length >= goal;
  const progress = Math.min(1, entries.length / goal);
  const done = entries.length >= goal;
  usePracticeDone("TASK_METAPHOR", practice && done);

  const showBigTask = data.variant === "elephant";
  const listLabel = data.variant === "nails" ? "Главные дела на день" : "Разбейте на куски";
  const placeholder =
    data.itemPlaceholder ?? (data.variant === "nails" ? "Важное дело…" : "Один конкретный шаг…");
  const doneMsg =
    data.variant === "nails"
      ? "Гвозди забиты — на день выбраны только главные дела."
      : "Слон съеден по кусочкам — крупная задача больше не пугает!";

  function addEntry() {
    const v = draft.trim();
    if (!v || capped) return;
    setEntries((p) => [...p, v]);
    setDraft("");
  }

  return (
    <>
      {showHeader ? <Header data={data} /> : null}
      <div className="mt-5 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          {showBigTask ? (
            <>
              <label className="text-xs font-medium text-foreground/55" htmlFor="metaphor-big">
                Крупная задача
              </label>
              <input
                id="metaphor-big"
                value={bigTask}
                onChange={(e) => setBigTask(e.target.value)}
                placeholder={data.bigTaskPlaceholder ?? "Задача, которая давит…"}
                className="mb-4 mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </>
          ) : null}

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground/55">{listLabel}</span>
            <span className="text-xs font-semibold text-foreground/45">
              {entries.length} / {goal}
            </span>
          </div>

          <div className="mt-1.5 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addEntry();
                }
              }}
              disabled={capped}
              placeholder={placeholder}
              className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-brand disabled:opacity-50"
            />
            <button
              type="button"
              onClick={addEntry}
              disabled={capped || !draft.trim()}
              aria-label="Добавить"
              className="flex shrink-0 items-center justify-center rounded-lg bg-brand px-3 text-white transition-opacity disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>

          <ul className="mt-3 space-y-1.5">
            <AnimatePresence initial={false}>
              {entries.map((it, i) => (
                <motion.li
                  key={`${i}-${it}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="flex items-center gap-2 rounded-lg bg-foreground/[0.04] px-3 py-1.5 text-sm"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[11px] font-semibold text-brand-strong">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-foreground/80">{it}</span>
                  <button
                    type="button"
                    onClick={() => setEntries((p) => p.filter((_, j) => j !== i))}
                    aria-label="Убрать"
                    className="text-foreground/30 transition-colors hover:text-foreground/70"
                  >
                    <X className="size-3.5" />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>

        <VisualColumn variant={data.variant} progress={progress} goal={goal} step={entries.length} />
      </div>

      <SuccessBanner show={done} tone="good" text={doneMsg} />
      <ResetButton onClick={() => { setBigTask(""); setEntries([]); setDraft(""); }} />
    </>
  );
}

// ─── Лягушка: «съешь худшее первым, иначе оно растёт» ─────────────────────────

type Frog = { id: number; text: string; level: 1 | 2 | 3; eaten: boolean };

const LEVELS: { value: 1 | 2 | 3; emoji: string; label: string }[] = [
  { value: 1, emoji: "🙂", label: "терпимо" },
  { value: 2, emoji: "😖", label: "неприятно" },
  { value: 3, emoji: "🤢", label: "очень противно" },
];

function FrogPanel({
  data,
  showHeader = true,
  practice = true,
}: {
  data: MetaphorData;
  showHeader?: boolean;
  practice?: boolean;
}) {
  const nextId = useRef(0);
  const [frogs, setFrogs] = useState<Frog[]>([]);
  const [draft, setDraft] = useState("");
  const [growth, setGrowth] = useState(0);
  const [finished, setFinished] = useState<null | "perfect" | "grown">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [signal, setSignal] = useState(0); // триггер анимации визуала

  const alive = frogs.filter((f) => !f.eaten);
  const maxLevel = alive.reduce((m, f) => Math.max(m, f.level), 0);
  // Съел самую противную первой — 100; каждое откладывание снимает 25.
  usePracticeDone("TASK_METAPHOR", practice && finished !== null, Math.max(0, 100 - growth * 25));

  function addFrog() {
    const v = draft.trim();
    if (!v || finished) return;
    setFrogs((p) => [...p, { id: nextId.current++, text: v, level: 2, eaten: false }]);
    setDraft("");
  }

  function setLevel(id: number, level: 1 | 2 | 3) {
    setFrogs((p) => p.map((f) => (f.id === id ? { ...f, level } : f)));
    setMsg(null);
  }

  function eat(f: Frog) {
    if (finished || f.eaten) return;
    const worst = alive.reduce((m, x) => Math.max(m, x.level), 0);
    setFrogs((p) => p.map((x) => (x.id === f.id ? { ...x, eaten: true } : x)));
    setSignal((s) => s + 1);
    if (f.level >= worst) {
      setFinished(growth > 0 ? "grown" : "perfect");
      setMsg(null);
    } else {
      const stillWorst = alive.find((x) => x.id !== f.id && x.level === worst);
      setGrowth((g) => g + 1);
      setMsg(
        stillWorst
          ? `Отложил лягушку — «${stillWorst.text}» стала ещё противнее. Начинай с самого тяжёлого!`
          : "Отложил лягушку — она растёт!",
      );
    }
  }

  function reset() {
    setFrogs([]);
    setDraft("");
    setGrowth(0);
    setFinished(null);
    setMsg(null);
    setSignal(0);
  }

  const progress = finished ? 1 : 0;
  // Стартует маленькой и раздувается с каждым откладыванием — так рост очевиден.
  // Растёт внутри своего холста (максимум 1.0 при 4+), не наезжая на список.
  const scale = 0.6 + Math.min(growth, 4) * 0.1;

  return (
    <>
      {showHeader ? <Header data={data} /> : null}
      <div className="mt-5 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <span className="text-xs font-medium text-foreground/55">
            Дела на день — отметьте, насколько каждое неприятно
          </span>
          <div className="mt-1.5 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addFrog();
                }
              }}
              disabled={!!finished}
              placeholder={data.itemPlaceholder ?? "Дело на день…"}
              className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-brand disabled:opacity-50"
            />
            <button
              type="button"
              onClick={addFrog}
              disabled={!!finished || !draft.trim()}
              aria-label="Добавить"
              className="flex shrink-0 items-center justify-center rounded-lg bg-brand px-3 text-white transition-opacity disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>

          {alive.length > 0 && !finished ? (
            <p className="mt-2 text-xs text-amber-700">
              🐸 Съешьте самое противное первым — иначе лягушка растёт.
            </p>
          ) : null}

          <ul className="mt-3 space-y-1.5">
            <AnimatePresence initial={false}>
              {frogs.map((f) => {
                const isWorst = !f.eaten && f.level === maxLevel && maxLevel > 0;
                return (
                  <motion.li
                    key={f.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: f.eaten ? 0.45 : 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                      f.eaten ? "bg-emerald-500/10" : isWorst ? "bg-amber-500/[0.07]" : "bg-foreground/[0.04]"
                    }`}
                  >
                    {/* Уровень неприятности */}
                    <div className="flex gap-0.5">
                      {LEVELS.map((lv) => (
                        <button
                          key={lv.value}
                          type="button"
                          disabled={f.eaten || !!finished}
                          onClick={() => setLevel(f.id, lv.value)}
                          aria-label={lv.label}
                          title={lv.label}
                          className={`grid size-6 place-items-center rounded-md text-sm transition ${
                            f.level === lv.value ? "bg-amber-500/20 ring-1 ring-amber-500/50" : "opacity-35 hover:opacity-70"
                          }`}
                        >
                          {lv.emoji}
                        </button>
                      ))}
                    </div>
                    <span className={`flex-1 ${f.eaten ? "text-foreground/60 line-through" : "text-foreground/85"}`}>
                      {f.text}
                    </span>
                    {f.eaten ? (
                      <span className="text-xs font-semibold text-emerald-700">✓ съедено</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => eat(f)}
                        disabled={!!finished}
                        className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-500/25 disabled:opacity-40"
                      >
                        🐸 съесть
                      </button>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </div>

        <VisualColumn
          variant="frog"
          progress={progress}
          goal={data.goal}
          step={signal}
          innerScale={scale}
          angry={growth > 0 && !finished}
          progressLabel={growth > 0 ? `выросла ×${growth}` : undefined}
        />
      </div>

      <AnimatePresence>
        {msg && !finished ? (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-800"
          >
            {msg}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <SuccessBanner
        show={finished === "perfect"}
        tone="good"
        text="🎉 Съел лягушку первой! Самое тяжёлое позади — остальной день пойдёт легче."
      />
      <SuccessBanner
        show={finished === "grown"}
        tone="warn"
        text={`Съел, но лягушка успела разрастись (×${growth}). В следующий раз начинай с самого противного — так проще.`}
      />

      <ResetButton onClick={reset} />
    </>
  );
}

function SuccessBanner({ show, tone, text }: { show: boolean; tone: "good" | "warn"; text: string }) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`mt-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
            tone === "good"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
              : "border-amber-500/30 bg-amber-500/10 text-amber-800"
          }`}
        >
          <PartyPopper className="size-4 shrink-0" />
          {text}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

// ─── Визуальная колонка (SVG + полоса прогресса) ──────────────────────────────

function VisualColumn({
  variant,
  progress,
  goal,
  step,
  innerScale = 1,
  angry = false,
  cuts,
  progressLabel,
  caption,
}: {
  variant: MetaphorVariant;
  progress: number;
  goal: number;
  step: number;
  innerScale?: number;
  angry?: boolean;
  cuts?: number;
  progressLabel?: string;
  caption?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 justify-self-center">
      <MetaphorVisual
        variant={variant}
        progress={progress}
        goal={goal}
        step={step}
        innerScale={innerScale}
        angry={angry}
        cuts={cuts}
      />
      {progressLabel ? (
        <span className="text-[11px] font-semibold text-amber-700">{progressLabel}</span>
      ) : (
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-foreground/10">
          <motion.div
            className="h-full rounded-full bg-brand"
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          />
        </div>
      )}
      {caption ? <span className="text-[11px] font-medium text-foreground/50">{caption}</span> : null}
    </div>
  );
}

// Силуэты одной path — game-icons.net, CC BY 3.0. Слон — Delapouite, лягушка — Lorc.
const ELEPHANT_PATH =
  "M236.422 98.393c-126.642-1.276-206.07 46.77-212.058 83.93-2.977 41.18-4.165 83.628-4.016 124.617l4.31 3.796c3.963-15.315 6.47-31.843 14.122-44.085 1.3 27.18 5.068 58.562 11.369 82.067-2.477 24.988-2.118 47.99-3.436 72.978 21.158 12.726 60.485 10.65 67.541 1.986 2.936-20.695 4.981-42.58 3.973-68.535l7.592-35.355c6.418-14.587 25.29-17.243 23.406-31.799l17.828-2.467c.355 25.196-14.375 27.1-24.713 41.653 12.994 5.357 14.676 3.886 24.059 5.124 23.848 2.742 45.234 3.774 67.802-8.175l-3.101-17.541 17.723-3.135 3.064 17.328c4.22 14.097 11.996 104.392 18.559 108.361 13.411 6.417 53.823 6.417 55.472-5.312 1.647-45.786 3.861-90.1-5.07-133.242 3.702-4.1 7.34-8.112 10.928-12.096-20.178-10.157-44.214-25.838-57.62-41.797-9.037-17.21-13.75-38.688-17.304-56.256-2.546-12.943-4.3-26.074-3.81-37.486.244-5.706 1.003-11.018 2.982-15.938 19.848-20.186 56.606-35.68 79.58-46.503-33.273-7.269-71.55 7.386-99.182 17.882zm128.934-9.931c-29.757 10.977-72.215 22.174-92.633 45.267-.807 2.008-1.51 5.563-1.7 9.994-.38 8.863 1.097 21.093 3.487 33.243 2.39 12.15 5.644 24.32 8.53 33.642 1.442 4.662 2.797 8.624 3.865 11.44 15.216 22.215 45.646 39.625 67.966 44.959l14.495-28.713c-11.574-15.04-13.779-35.226-4.59-50.352 4.932-6.143 9.727-10.553 16.982-10.416 4.545.109 9.194 1.996 12.856 5.045 25.905 21.572 49.481 48.69 83.37 70.66-.136-6.626-.26-12.94-.243-18.761.026-9.03-18.924-97.759-50.614-139.553-22.918-5.83-40.343-9.14-61.771-6.455zm68.883 76.232c4.327-.07 8.421.563 11.857 2.319.061 4.922-.298 10.035-10.887 16.152-4.501-4.72-11.239-10.838-17.908-15.627 5.427-1.506 11.374-2.754 16.938-2.844zm-54.233 32.838c-2.263 3.593-3.912 11.657-2.703 17.531 1.402 6.812 9.062 16.901 21.55 26.47 12.49 9.567 29.242 18.77 46.753 26.087 15.609 6.522 31.748 11.435 46.058 14.19-49.78-25.118-79.482-61.19-108.566-85.409-1.548-1.595-2.387.034-3.092 1.131zm58.914 86.797c.526 23.427-2.416 50.265-17.086 59.894-11.128 7.306-33.235 1.34-38.41-10.925-3.657-8.667 15.567-15.677 13.408-24.832-1.718-7.287-11.033-14.374-18.375-12.912-17.881 3.558-34.905 28.836-29.3 46.185 10.14 31.387 62.177 51.105 91.875 36.75 27.49-13.288 35.058-46.714 36.808-81.19-12.704-3.13-25.983-7.579-38.92-12.97zm-200.681 52.52a129.415 129.415 0 0 1-9.993 4.34l-8.67 77.603c1.22 8.802 15.819 12.647 30.385 12.81zm-100.65 4.519c-1.341 10.733-2.367 21.785-3.073 30.953-1.545 20.225-2.483 41.562-2.496 51.49 18.869 11.927 54.798 4.533 53.105-2.005-.656-27.278-6.002-49.806-12.58-73.717-11.983-1.258-23.524-3.864-34.957-6.721z";

const FROG_PATH =
  "M335.7 88.94c-4.742.194-9.563 1.486-14.204 4.165-38.934 22.48-89.77 21.953-127.79.002-6.09-3.516-12.285-4.61-18.145-3.892a46.38 46.38 0 0 1 9.438 28.09c0 23.15-17.037 42.83-39.176 45.095-12.775 14.92-21.553 31.807-24.386 49.983 44.73-23.79 90.947-35.572 137.064-35.508 46.15.064 92.197 11.987 136.56 35.62-2.69-18.15-11.216-35.043-23.794-49.92-.585.026-1.17.048-1.76.048-24.18 0-43.447-20.7-43.447-45.318 0-10.64 3.6-20.543 9.64-28.364zm-194.15 3.216c-12.67 0-23.277 10.85-23.277 25.15 0 14.297 10.608 25.147 23.278 25.147 12.67 0 23.276-10.85 23.276-25.148s-10.606-25.15-23.275-25.15zm227.956 0c-12.67 0-23.277 10.85-23.277 25.15 0 14.297 10.607 25.147 23.276 25.147 12.67 0 23.277-10.85 23.277-25.148s-10.608-25.15-23.277-25.15zm67.572 93.367c-8.525.088-17.893 1.546-27.853 4.243 6.926 19.457 8.57 40.725 2.695 62.656-4.26 15.896.933 37.475 11.7 54.758l4.69 7.53-7.02 5.43c-19.765 15.28-36.44 25.107-46.104 35.264-9.664 10.158-13.887 19.59-10.915 40.875l1.525 10.91c3.596 4.7 7.678 9.43 12.142 14.06 19.876-14.55 36.01-23.887 68.344-4.094-6.738-18.804 15.938-29.762 46.72-29.78-36.91-15.88-64.98-25.62-86.438-30.376 67.492-72.188 97.182-127.96 66-159.188-8.172-8.183-19.356-12.034-33.28-12.28a80.764 80.764 0 0 0-2.204-.01zm-361.617.002a79.679 79.679 0 0 0-2.397.006c-13.925.248-25.14 4.1-33.313 12.282-31.182 31.227-1.492 87 66 159.188-21.456 4.756-49.528 14.497-86.438 30.375 30.782.02 53.458 10.977 46.72 29.78 32.332-19.792 48.468-10.454 68.343 4.095 6.713-6.962 12.572-14.146 17.188-21.12l.537-3.85c2.972-21.283-1.25-30.716-10.914-40.874-9.664-10.157-26.34-19.984-46.106-35.265l-7.02-5.427 4.692-7.53c10.73-17.228 15.858-39.233 11.7-54.76-5.782-21.572-4.185-42.44 2.536-61.56-11.336-3.388-21.954-5.216-31.527-5.338zm183.038 9.66c-46.096-.065-92.3 12.827-137.574 38.846a87.261 87.261 0 0 0 2.494 13.31v.002c5.453 20.354.593 42.93-9.484 62.297 15.89 11.634 30.343 20.526 41.478 32.23 10.36 10.89 16.795 25.132 16.955 43.712-1.096 16.308-9.157 39.273-22.347 59.244 24.59-14.237 42.134-15.333 45.29 3.492 14.097-17.783 25.698-20.386 38.985-8.035-3.745-31.452-11.117-52.887-17.258-65.097-14.896-36.567-42.816-61.484-73.742-83.424l11.36-16.014c38.788 27.517 76.798 62.663 89.124 119.566 9.628.705 19.25.65 28.85-.16 12.362-56.81 50.334-91.918 89.085-119.408l11.36 16.016c-31.19 22.127-59.333 47.28-74.13 84.363-6.045 12.357-13.14 33.493-16.793 64.158 13.29-12.35 24.89-9.748 38.987 8.035 3.153-18.825 20.697-17.73 45.288-3.492-13.51-20.455-21.645-44.058-22.42-60.424.415-18.01 6.81-31.872 16.95-42.533 11.135-11.705 25.586-20.595 41.474-32.23-10.064-19.29-14.99-41.736-9.48-62.302a88.613 88.613 0 0 0 2.51-13.266c-44.85-25.79-90.852-38.82-136.964-38.886z";

/**
 * Анимированный SVG-акцент. Силуэт (слон/лягушка) заполняется по прогрессу:
 * снизу вверх, а слон, разрезанный на куски (cuts), — слева направо, кусок за
 * куском. Гвозди — забиваются по одному. Реагирует на шаг (step) подскоком и на
 * касание; лягушка ещё и растёт (innerScale) и «злится» (angry) при откладывании.
 * Рост — масштаб группы ВНУТРИ viewBox (≤1), чтобы силуэт не вылезал за холст.
 */
function MetaphorVisual({
  variant,
  progress,
  goal,
  step,
  innerScale = 1,
  angry = false,
  cuts,
}: {
  variant: MetaphorVariant;
  progress: number;
  goal: number;
  step: number;
  innerScale?: number;
  angry?: boolean;
  cuts?: number;
}) {
  const clipId = useId();
  const shapeId = useId();
  const bounce = useAnimationControls();
  const prevStep = useRef(step);

  useEffect(() => {
    if (step > prevStep.current) {
      bounce.start({ y: [0, -14, 0], transition: { duration: 0.45, ease: "easeOut" as const } });
    }
    prevStep.current = step;
  }, [step, bounce]);

  const touch = {
    whileHover: { scale: 1.06 },
    whileTap: { rotate: [0, -7, 6, -3, 0], transition: { duration: 0.55, ease: "easeInOut" as const } },
  };

  if (variant === "nails") {
    const filled = Math.round(progress * goal);
    const slots = Array.from({ length: goal });
    const gap = 160 / goal;
    return (
      <motion.svg viewBox="0 0 180 160" className="h-40 w-44 cursor-pointer select-none" role="img" aria-label="Гвозди" animate={bounce} {...touch}>
        <rect x="8" y="104" width="164" height="40" rx="8" className="fill-amber-900/20" />
        <rect x="8" y="104" width="164" height="8" rx="4" className="fill-amber-900/30" />
        {slots.map((_, i) => {
          const x = 18 + gap * i + gap / 2;
          const on = i < filled;
          const headY = on ? 96 : 44;
          return (
            <g key={i} className={on ? "fill-amber-500" : "fill-foreground/15"}>
              <rect x={x - 3} y={headY} width="6" height={132 - headY} rx="2" />
              <rect x={x - 12} y={headY - 8} width="24" height="10" rx="3" />
            </g>
          );
        })}
      </motion.svg>
    );
  }

  const path = variant === "frog" ? FROG_PATH : ELEPHANT_PATH;
  const H = 512;
  // Слон занимает по x примерно 20…492: режем эту ширину на равные куски, чтобы
  // линии разреза и заливка «съеденного» совпадали.
  const X0 = 20;
  const W = 472;
  const sideways = variant === "elephant" && !!cuts && cuts > 1;
  const clipRect = sideways
    ? { x: 0, y: 0, width: progress >= 1 ? 512 : X0 + W * progress, height: H }
    : { x: 0, y: H * (1 - progress), width: 512, height: H * progress + 8 };

  return (
    <motion.svg
      viewBox="0 0 512 512"
      className="h-40 w-44 cursor-pointer select-none"
      role="img"
      aria-label={variant === "frog" ? "Лягушка — потрогай меня" : "Слон — потрогай меня"}
      initial={false}
      animate={bounce}
      {...touch}
    >
      <defs>
        <clipPath id={clipId}>
          <motion.rect
            initial={false}
            animate={clipRect}
            transition={{ type: "spring", stiffness: 220, damping: 30 }}
          />
        </clipPath>
        {sideways ? (
          <clipPath id={shapeId}>
            <path d={path} />
          </clipPath>
        ) : null}
      </defs>
      <motion.g
        initial={false}
        animate={{ scale: innerScale }}
        transition={{ type: "spring", stiffness: 260, damping: 14 }}
        style={{ originX: 0.5, originY: 0.5 }}
      >
        <path
          d={path}
          className={`transition-colors duration-300 ${angry ? "fill-red-500/25" : "fill-foreground/10"}`}
        />
        <path d={path} className="fill-amber-500" clipPath={`url(#${clipId})`} />
        {sideways ? (
          // Линии разреза цветом фона, обрезанные по силуэту, — слон «нарезан».
          <g clipPath={`url(#${shapeId})`} className="stroke-background" strokeWidth={9}>
            {Array.from({ length: cuts - 1 }, (_, i) => {
              const x = X0 + (W * (i + 1)) / cuts;
              return <line key={i} x1={x} y1={0} x2={x} y2={H} />;
            })}
          </g>
        ) : null}
      </motion.g>
    </motion.svg>
  );
}
