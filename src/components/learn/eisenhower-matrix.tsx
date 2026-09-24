"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useAnimationControls, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Plus, RotateCcw, Undo2, X } from "lucide-react";
import type { EisenhowerCase, EisenhowerData } from "@/lib/interactive";
import { usePracticeDone } from "@/components/learn/practice-context";
import { seededShuffle } from "@/lib/learn/format";

/**
 * Интерактивная матрица Эйзенхауэра. Если в данных есть дела из урока (`cases`),
 * первый шаг — проверяемый раунд: дела приходят по одному, ученик кладёт каждое
 * в квадрант; промах — карточка отскакивает с объяснением из урока, и отдельно
 * считаем главную ловушку урока: «пожарника» (C), принятого за A. Второй шаг —
 * свободная матрица со СВОИМИ задачами. Без `cases` — только свободная матрица,
 * как раньше. Оболочка без AI-контента и без сохранения (ПДн не собираем).
 * Портрет Д. Эйзенхауэра — общественное достояние (офиц. госфото США, 1959).
 */

type QuadrantKey = 0 | 1 | 2 | 3;

interface Task {
  id: number;
  text: string;
  q: QuadrantKey | null;
}

const QUADRANTS: {
  key: QuadrantKey;
  letter: string;
  action: string;
  hint: string;
  cls: string; // рамка/фон карточки
  chip: string; // фон фишки в квадранте
  btn: string; // кнопка «положить сюда»
}[] = [
  {
    key: 0,
    letter: "A",
    action: "Сделать сейчас",
    hint: "Важно и срочно — кризисы, дедлайны",
    cls: "border-red-500/30 bg-red-500/[0.04]",
    chip: "bg-red-500/12 text-red-700",
    btn: "bg-red-500/15 text-red-700 hover:bg-red-500/25",
  },
  {
    key: 1,
    letter: "B",
    action: "Запланировать",
    hint: "Важно, не срочно — цели, развитие",
    cls: "border-emerald-500/30 bg-emerald-500/[0.04]",
    chip: "bg-emerald-500/12 text-emerald-700",
    btn: "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25",
  },
  {
    key: 2,
    letter: "C",
    // В уроке C — «пожарник», которого сокращают, а не делегируют: письмо вместо
    // звонка, позже, короче. Делегирование в курсе — только в уроке 15.
    action: "Сократить",
    hint: "Срочно, не важно — «пожарник»: письмом, позже или короче",
    cls: "border-amber-500/30 bg-amber-500/[0.04]",
    chip: "bg-amber-500/15 text-amber-800",
    btn: "bg-amber-500/20 text-amber-800 hover:bg-amber-500/30",
  },
  {
    key: 3,
    letter: "D",
    action: "Удалить",
    hint: "Не важно и не срочно — пожиратели времени",
    cls: "border-foreground/15 bg-foreground/[0.03]",
    chip: "bg-foreground/10 text-foreground/70",
    btn: "bg-foreground/10 text-foreground/60 hover:bg-foreground/20",
  },
];

export function EisenhowerMatrix({ data }: { data: EisenhowerData }) {
  const cases = data.cases;
  const [step, setStep] = useState<"game" | "sandbox">(cases ? "game" : "sandbox");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);

  // Свободная матрица засчитывается, только если нет проверяемого раунда.
  const [sandboxDone, setSandboxDone] = useState(false);
  const done = cases ? result !== null : sandboxDone;
  usePracticeDone("EISENHOWER", done, cases && result ? result.score : undefined);

  function restart() {
    setResult(null);
    setAttempt((a) => a + 1);
    setStep("game");
  }

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <Image
          src="/images/eisenhower.jpg"
          alt="Дуайт Эйзенхауэр"
          width={56}
          height={70}
          className="hidden shrink-0 rounded-lg object-cover shadow-sm sm:block"
        />
        <div className="min-w-0">
          <h3 className="font-bold">{data.title}</h3>
          <p className="mt-1 text-sm text-foreground/65">{data.prompt}</p>
          <p className="mt-1 text-[11px] text-foreground/40">
            Матрица названа в честь Дуайта Эйзенхауэра, 34-го президента США: «Важное редко бывает срочным, а срочное — важным».
          </p>
        </div>
      </div>

      {cases ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
            {step === "game" ? "Шаг 1 из 2 · Дела из урока" : "Шаг 2 из 2 · Свои задачи"}
          </span>
          {step === "sandbox" ? (
            <button
              type="button"
              onClick={restart}
              className="flex items-center gap-1 text-xs font-medium text-foreground/50 transition-colors hover:text-foreground/80"
            >
              <RotateCcw className="size-3.5" /> Пройти дела из урока заново
            </button>
          ) : null}
        </div>
      ) : null}

      {cases && step === "game" ? (
        <CaseRound
          key={attempt}
          cases={cases}
          seed={`eisenhower-${attempt}`}
          result={result}
          onFinish={setResult}
          onRestart={restart}
          onNext={() => setStep("sandbox")}
        />
      ) : (
        <Sandbox seedTasks={data.seedTasks ?? []} onDoneChange={setSandboxDone} />
      )}
    </div>
  );
}

// ─── Шаг 1: дела из урока, с проверкой ────────────────────────────────────────

interface GameResult {
  score: number; // доля верных с первой попытки, 0–100
  firstTry: boolean[]; // по индексу дела в data.cases
  fire: number; // сколько раз «пожарника» (C) положили в A
}

type Feedback = { ok: boolean; q: QuadrantKey; caseIdx: number; n: number };

function CaseRound({
  cases,
  seed,
  result,
  onFinish,
  onRestart,
  onNext,
}: {
  cases: EisenhowerCase[];
  seed: string;
  result: GameResult | null;
  onFinish: (r: GameResult) => void;
  onRestart: () => void;
  onNext: () => void;
}) {
  const reduce = useReducedMotion();
  const shake = useAnimationControls();
  // Порядок детерминирован от seed: одинаковый на сервере и в браузере.
  const order = useMemo(() => seededShuffle(cases.map((_, i) => i), seed), [cases, seed]);
  const [pos, setPos] = useState(0);
  const [placed, setPlaced] = useState<number[]>([]);
  const [missed, setMissed] = useState<number[]>([]);
  const [fire, setFire] = useState(0);
  const [fb, setFb] = useState<Feedback | null>(null);

  const curIdx = pos < order.length ? order[pos]! : null;
  const cur = curIdx !== null ? cases[curIdx]! : null;

  function choose(q: QuadrantKey, dragged?: number) {
    // Перетащили уезжающую (уже разложенную) карточку — не считаем за ход.
    if (curIdx === null || !cur || (dragged !== undefined && dragged !== curIdx)) return;
    const n = (fb?.n ?? 0) + 1;
    if (q === cur.q) {
      const nextPlaced = [...placed, curIdx];
      setPlaced(nextPlaced);
      setFb({ ok: true, q, caseIdx: curIdx, n });
      setPos(pos + 1);
      if (pos + 1 >= order.length) {
        const firstTry = cases.map((_, i) => !missed.includes(i));
        const score = Math.round((firstTry.filter(Boolean).length / cases.length) * 100);
        onFinish({ score, firstTry, fire });
      }
      return;
    }
    // Промах: засчитываем один раз на дело (балл — по первой попытке), а
    // «пожарника в A» считаем каждый раз — это та самая ошибка из урока.
    if (!missed.includes(curIdx)) setMissed([...missed, curIdx]);
    if (cur.q === 2 && q === 0) setFire((f) => f + 1);
    setFb({ ok: false, q, caseIdx: curIdx, n });
    void shake.start(
      reduce
        ? { opacity: [1, 0.55, 1], transition: { duration: 0.35 } }
        : { x: [0, -14, 12, -8, 6, -3, 0], transition: { duration: 0.45 } },
    );
  }

  const byQ = (k: QuadrantKey) =>
    placed.filter((i) => cases[i]!.q === k).map((i) => ({ id: i, text: cases[i]!.text }));

  const fbCase = fb ? cases[fb.caseIdx]! : null;
  const fireTrap = fb && !fb.ok && fbCase?.q === 2 && fb.q === 0;

  return (
    <div className="mt-3">
      {/* Текущее дело */}
      {cur && curIdx !== null ? (
        <div className="rounded-xl border border-dashed border-foreground/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-foreground/55">
            <span className="font-medium">Куда это дело? Нажмите на квадрант или перетащите карточку</span>
            <span className="shrink-0 tabular-nums">
              {pos + 1} / {order.length}
            </span>
          </div>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={curIdx}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
            >
              <motion.div
                animate={shake}
                draggable
                onDragStartCapture={(e: React.DragEvent) => e.dataTransfer.setData("text/plain", String(curIdx))}
                className="rounded-lg border border-foreground/15 bg-background px-3 py-2.5 text-sm font-medium text-foreground/90 shadow-sm [cursor:grab] active:[cursor:grabbing]"
              >
                {cur.text}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      ) : null}

      {/* Обратная связь по последнему ходу */}
      <AnimatePresence mode="wait" initial={false}>
        {fb && fbCase ? (
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
                  <b>{fbCase.text}</b> — {fbCase.why}
                </>
              ) : fireTrap ? (
                <>
                  <b>Это «пожарник», а не A.</b> Что изменится, если сделать это позже или письмом? {fbCase.why}{" "}
                  Попробуйте ещё раз.
                </>
              ) : (
                <>
                  <b>Не {QUADRANTS[fb.q]!.letter}.</b> {fbCase.why} Попробуйте ещё раз.
                </>
              )}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Matrix
        game
        items={byQ}
        mark={fb && !fb.ok && cur ? fb.q : null}
        onPick={cur ? (q, id) => choose(q, id) : undefined}
      />

      {result ? <Summary cases={cases} result={result} onRestart={onRestart} onNext={onNext} /> : null}
    </div>
  );
}

function Summary({
  cases,
  result,
  onRestart,
  onNext,
}: {
  cases: EisenhowerCase[];
  result: GameResult;
  onRestart: () => void;
  onNext: () => void;
}) {
  const right = result.firstTry.filter(Boolean).length;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="mt-4 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4"
    >
      <p className="text-sm font-bold">
        С первой попытки: {right} из {cases.length} ({result.score}%)
      </p>

      {/* Доли дел по квадрантам и точность в каждом */}
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {QUADRANTS.map((q) => {
          const idx = cases.map((c, i) => (c.q === q.key ? i : -1)).filter((i) => i >= 0);
          const ok = idx.filter((i) => result.firstTry[i]).length;
          const share = Math.round((idx.length / cases.length) * 100);
          return (
            <li key={q.key} className={`min-w-0 rounded-lg border px-3 py-2 ${q.cls}`}>
              <p className="text-xs font-semibold text-foreground/80">
                {q.letter} · {q.action}
              </p>
              <p className="mt-0.5 text-[11px] text-foreground/55">
                {idx.length} {plural(idx.length, "дело", "дела", "дел")} ({share}%), с первой попытки {ok}/{idx.length}
              </p>
            </li>
          );
        })}
      </ul>

      {result.fire > 0 ? (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900">
          Вы {result.fire} {plural(result.fire, "раз", "раза", "раз")} приняли «пожарника» за A. Это главная ловушка урока:
          рабочие цели мы не успеваем как раз потому, что путаем квадраты и делаем дела из C вместо дел из A.
        </p>
      ) : (
        <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800">
          Ни разу не приняли «пожарника» за A — а это главная ловушка урока: из-за неё мы не успеваем рабочие цели.
        </p>
      )}

      <p className="mt-3 text-sm text-foreground/75">
        Правило урока: эффективный менеджер работает в квадратах <b>A</b> и <b>B</b>, «пожарника» из <b>C</b>{" "}
        сокращает — письмом, позже или короче, а корзину <b>D</b> выкидывает.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
        >
          Разложить свои задачи <ArrowRight className="size-4" />
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

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

// ─── Шаг 2 (или единственный): свои задачи без проверки ───────────────────────

function Sandbox({ seedTasks, onDoneChange }: { seedTasks: string[]; onDoneChange: (done: boolean) => void }) {
  const nextId = useRef(0);
  const [tasks, setTasks] = useState<Task[]>(() => seedTasks.map((text) => ({ id: nextId.current++, text, q: null })));
  const [draft, setDraft] = useState("");

  const unsorted = tasks.filter((t) => t.q === null);
  // Засчитываем, когда разложено хотя бы три задачи и неразобранных не осталось.
  const sandboxDone = tasks.length >= 3 && unsorted.length === 0;
  useEffect(() => onDoneChange(sandboxDone), [sandboxDone, onDoneChange]);

  function addTask() {
    const v = draft.trim();
    if (!v) return;
    setTasks((p) => [...p, { id: nextId.current++, text: v, q: null }]);
    setDraft("");
  }

  const place = (id: number, q: QuadrantKey | null) => setTasks((p) => p.map((t) => (t.id === id ? { ...t, q } : t)));

  return (
    <>
      {/* Ввод задачи */}
      <div className="mt-5 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTask();
            }
          }}
          placeholder="Добавьте задачу из своего дня…"
          className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button
          type="button"
          onClick={addTask}
          disabled={!draft.trim()}
          aria-label="Добавить задачу"
          className="flex shrink-0 items-center justify-center rounded-lg bg-brand px-3 text-white transition-opacity disabled:opacity-40"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {/* Неразобранные задачи + быстрые кнопки-квадранты */}
      <AnimatePresence>
        {unsorted.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 rounded-xl border border-dashed border-foreground/20 p-3"
          >
            <p className="mb-2 text-xs font-medium text-foreground/55">
              Перетащите в квадрант или нажмите кнопку ({unsorted.length}):
            </p>
            <ul className="space-y-2">
              {unsorted.map((t) => (
                <li
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", String(t.id))}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-foreground/[0.04] px-3 py-2 [cursor:grab] active:[cursor:grabbing]"
                >
                  <span className="mr-1 flex-1 text-sm text-foreground/85">{t.text}</span>
                  {QUADRANTS.map((q) => (
                    <button
                      key={q.key}
                      type="button"
                      onClick={() => place(t.id, q.key)}
                      className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${q.btn}`}
                    >
                      {q.action}
                    </button>
                  ))}
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Matrix
        items={(k) => tasks.filter((t) => t.q === k)}
        onReturn={(id) => place(id, null)}
        onDropTask={(id, q) => place(id, q)}
      />

      {tasks.length > 0 && unsorted.length === 0 ? (
        <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700">
          Все задачи разложены. Работайте в квадрантах «Сделать сейчас» и «Запланировать», «пожарников» сокращайте,
          корзину выкидывайте.
        </p>
      ) : null}
    </>
  );
}

// ─── Матрица 2×2 (общая для обоих шагов) ──────────────────────────────────────

type Item = { id: number; text: string };

function Matrix({
  game,
  items,
  mark,
  onPick,
  onReturn,
  onDropTask,
}: {
  game?: boolean;
  items: (k: QuadrantKey) => Item[];
  mark?: QuadrantKey | null;
  onPick?: (q: QuadrantKey, draggedId?: number) => void;
  onReturn?: (id: number) => void;
  onDropTask?: (id: number, q: QuadrantKey) => void;
}) {
  const cell = (k: QuadrantKey) => (
    <Quadrant
      q={QUADRANTS[k]!}
      game={game}
      items={items(k)}
      wrong={mark === k}
      onPick={onPick ? () => onPick(k) : undefined}
      onReturn={onReturn}
      onDropTask={(id) => (onPick ? onPick(k, id) : onDropTask?.(id, k))}
    />
  );
  return (
    <div className="mt-4">
      {/* Заголовки колонок */}
      <div className="mb-1 grid grid-cols-[auto_1fr_1fr] gap-2 text-center text-[11px] font-semibold uppercase tracking-wide text-foreground/40">
        <span />
        <span>Срочно</span>
        <span>Не срочно</span>
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <RowLabel>Важно</RowLabel>
        {cell(0)}
        {cell(1)}
        <RowLabel>Не важно</RowLabel>
        {cell(2)}
        {cell(3)}
      </div>
    </div>
  );
}

function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-6 items-center justify-center">
      <span className="rotate-180 text-[11px] font-semibold uppercase tracking-wide text-foreground/40 [writing-mode:vertical-rl]">
        {children}
      </span>
    </div>
  );
}

function Quadrant({
  q,
  game,
  items,
  wrong,
  onPick,
  onReturn,
  onDropTask,
}: {
  q: (typeof QUADRANTS)[number];
  game?: boolean;
  items: Item[];
  wrong?: boolean;
  onPick?: () => void;
  onReturn?: (id: number) => void;
  onDropTask: (id: number) => void;
}) {
  const [over, setOver] = useState(false);
  const pickable = !!onPick;
  return (
    <div
      role={pickable ? "button" : undefined}
      tabIndex={pickable ? 0 : undefined}
      aria-label={pickable ? `Положить в квадрант ${q.letter}: ${q.action}` : undefined}
      onClick={onPick}
      onKeyDown={
        pickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPick?.();
              }
            }
          : undefined
      }
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = Number(e.dataTransfer.getData("text/plain"));
        if (!Number.isNaN(id)) onDropTask(id);
      }}
      className={`min-h-28 min-w-0 rounded-xl border p-3 transition-colors ${q.cls} ${
        over ? "ring-2 ring-brand/60 ring-offset-1" : ""
      } ${wrong ? "ring-2 ring-rose-500/60 ring-offset-1" : ""} ${
        pickable ? "cursor-pointer outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-brand" : ""
      }`}
    >
      <p className="text-sm font-semibold text-foreground/80">
        {game ? <span className="mr-1 text-foreground/45">{q.letter}</span> : null}
        {q.action}
      </p>
      <p className="mt-0.5 text-[11px] text-foreground/45">{q.hint}</p>
      <ul className="mt-2 space-y-1.5">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.li
              key={t.id}
              layout
              draggable={!game}
              onDragStartCapture={game ? undefined : (e: React.DragEvent) => e.dataTransfer.setData("text/plain", String(t.id))}
              initial={{ opacity: 0, scale: 0.85, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
              className={`group flex items-center gap-1.5 break-words rounded-md px-2 py-1 text-xs ${
                game ? "" : "[cursor:grab] active:[cursor:grabbing]"
              } ${q.chip}`}
            >
              <span className="min-w-0 flex-1">{t.text}</span>
              {onReturn ? (
                <button
                  type="button"
                  onClick={() => onReturn(t.id)}
                  aria-label="Вернуть в список"
                  className="opacity-40 transition-opacity hover:opacity-90"
                >
                  <Undo2 className="size-3" />
                </button>
              ) : null}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
