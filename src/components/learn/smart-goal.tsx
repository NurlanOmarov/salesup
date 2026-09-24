"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, RefreshCw, X } from "lucide-react";
import type { SmartGoalData } from "@/lib/interactive";
import { seededShuffle } from "@/lib/learn/format";
import { usePracticeDone } from "@/components/learn/practice-context";

/**
 * SMART-цель (урок 05). Раунд 0 «Мечта или цель?» — примеры из урока: ученик
 * отличает хотелку от SMART-цели и от цели, недостижимой за такой срок. Затем —
 * своя цель: кольцо мишени закрывается, только когда критерий проходит проверку
 * по формуле урока (два числа «с какого до какого», дата и т. п.), а не от любых
 * двух символов. Оболочка без AI-контента и без сохранения (ПДн не собираем).
 */

type Verdict = "dream" | "smart" | "far";

const VERDICTS: { key: Verdict; label: string }[] = [
  { key: "dream", label: "Мечта" },
  { key: "smart", label: "Цель по SMART" },
  { key: "far", label: "Недостижима за этот срок" },
];

// Примеры — строго из урока 05 (Яна, 600 → 700 $, 500 → 5000 $).
const EXAMPLES: { text: string; answer: Verdict; why: string }[] = [
  {
    text: "Хочу зарабатывать много денег",
    answer: "dream",
    why: "Ни конкретики, ни «с какого до какого», ни срока. Это мечта: хотелка ничем не ограничена, а цель ограничена критериями.",
  },
  {
    text: "Увеличить заработок с 600 до 700 $ в месяц к 5 апреля",
    answer: "smart",
    why: "Конкретно, измеримо (с 600 до 700 $), достижимо (+100 $ при средней по рынку 600 $), деньги нужны сейчас, дата есть.",
  },
  {
    text: "Зарабатываю 500 $ — норма рынка. Со следующего месяца хочу 5000 $ в месяц",
    answer: "far",
    why: "Цифры есть, но сразу вопрос по достижимости: в 10 раз за месяц. Через год-два это реальнее — такая цель на долгую дистанцию, а SMART — краткосрочная.",
  },
  {
    text: "Хочу хорошую машину и дом за городом",
    answer: "dream",
    why: "Так говорят очень многие — но без суммы, срока и шагов это мечта, а не цель.",
  },
];

// ─── Проверки критериев по уроку ──────────────────────────────────────────────

const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const MONTHS = /(январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)/iu;
const UNIT = /\d+([.,]\d+)?\s*-?\s*(дн|день|недел|месяц|мес\b|год|лет|квартал|час)/iu;
const DATE = /\b\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?\b/;
const SOON = /через\s+(неделю|месяц|квартал|год|полгода)/iu;

const CRITERIA: {
  key: string;
  letter: string;
  label: string;
  hint: string;
  test: (v: string) => boolean;
  fix: string;
}[] = [
  {
    key: "s",
    letter: "S",
    label: "Конкретная",
    hint: "Что именно и для чего сделать?",
    test: (v) => words(v) >= 3,
    fix: "Чуть подробнее — хотя бы 3 слова: что именно вы хотите, например «увеличить свой заработок».",
  },
  {
    key: "m",
    letter: "M",
    label: "Измеримая",
    hint: "С какого до какого? Например: было 600 $ → стало 700 $",
    test: (v) => (v.match(/\d+(?:[.,]\d+)?/g) ?? []).length >= 2,
    fix: "Нужны два числа — «с какого до какого»: например, с 600 до 700 $.",
  },
  {
    key: "a",
    letter: "A",
    label: "Достижимая",
    hint: "Реально ли с вашими ресурсами?",
    test: (v) => words(v) >= 2,
    fix: "Почему это реально? Ресурсы — коллеги, руководитель, те, кто уже зарабатывает больше.",
  },
  {
    key: "r",
    letter: "R",
    label: "Совместимая",
    hint: "Уместна ли сейчас — «хороша ложка к обеду»? Нужна ли вам эта цель?",
    test: (v) => words(v) >= 2,
    fix: "Зачем вам это сейчас? «Хороша ложка к обеду»: например, нужны деньги на отпуск.",
  },
  {
    key: "t",
    letter: "T",
    label: "Временные рамки",
    hint: "К какой дате? Например: к 5 апреля",
    test: (v) => MONTHS.test(v) || UNIT.test(v) || DATE.test(v) || SOON.test(v),
    fix: "Нужна дата или срок: «к 5 апреля», «за 30 дней», «через месяц».",
  },
];

const RINGS = [82, 64, 46, 28]; // радиусы колец (внешнее → внутреннее), + центр

export function SmartGoal({ data }: { data: SmartGoalData }) {
  // Примеры урока подходят только SMART-интерактиву этого курса.
  const withQuiz = /SMART/i.test(`${data.title} ${data.prompt}`);
  const reduce = useReducedMotion();

  const [attempt, setAttempt] = useState(0);
  const [stage, setStage] = useState<"quiz" | "quizDone" | "own">(withQuiz ? "quiz" : "own");
  const [index, setIndex] = useState(0);
  const [wrong, setWrong] = useState<Verdict[]>([]);
  const [solved, setSolved] = useState(false);
  const [firstTry, setFirstTry] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);

  const [goal, setGoal] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const examples = useMemo(() => seededShuffle(EXAMPLES, `smart#${attempt}`), [attempt]);
  const ex = (examples[index] ?? EXAMPLES[0]) as (typeof EXAMPLES)[number];

  const passed = CRITERIA.filter((c) => c.test(answers[c.key] ?? "")).length;
  const goalOk = goal.trim().length >= 2 && passed === CRITERIA.length;
  const quizOver = !withQuiz || stage !== "quiz";
  const done = quizOver && goalOk;
  const score = withQuiz ? Math.round((firstTry / EXAMPLES.length) * 100) : undefined;
  usePracticeDone("SMART_GOAL", done, score);

  function pick(v: Verdict) {
    if (solved || wrong.includes(v)) return;
    if (v === ex.answer) {
      setSolved(true);
      if (wrong.length === 0) setFirstTry((n) => n + 1);
    } else {
      setWrong((w) => [...w, v]);
      setShakeKey((k) => k + 1);
    }
  }

  function next() {
    if (index + 1 >= examples.length) {
      setStage("quizDone");
      return;
    }
    setIndex((i) => i + 1);
    setWrong([]);
    setSolved(false);
    setShakeKey(0);
  }

  function restart() {
    setAttempt((a) => a + 1);
    setStage(withQuiz ? "quiz" : "own");
    setIndex(0);
    setWrong([]);
    setSolved(false);
    setFirstTry(0);
    setShakeKey(0);
    setGoal("");
    setAnswers({});
  }

  const header = (
    <>
      <h3 className="font-bold">{data.title}</h3>
      <p className="mt-1 text-sm text-foreground/65">{data.prompt}</p>
    </>
  );

  if (stage === "quiz") {
    const lastWrong = wrong[wrong.length - 1];
    return (
      <div className="rounded-2xl border border-foreground/10 bg-background p-4 sm:p-6">
        {header}
        <div className="mt-4 flex items-center justify-between text-xs font-medium text-foreground/55">
          <span>Раунд 0. Мечта или цель?</span>
          <span>
            {index + 1} из {examples.length}
          </span>
        </div>

        <motion.div
          key={index}
          initial={false}
          // Чётность счётчика меняет кадры — так тряска повторяется на каждую ошибку.
          animate={
            shakeKey && !solved && !reduce
              ? { x: shakeKey % 2 ? [0, -8, 8, -5, 5, 0] : [0, 8, -8, 5, -5, 0] }
              : { x: 0 }
          }
          transition={{ duration: 0.45 }}
          className={`mt-2 rounded-2xl border p-4 transition-colors ${
            solved ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-foreground/10 bg-foreground/[0.03]"
          }`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">Человек говорит</p>
          <p className="mt-1 font-semibold">«{ex.text}»</p>
        </motion.div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {VERDICTS.map((v) => {
            const isWrong = wrong.includes(v.key);
            const isRight = solved && v.key === ex.answer;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => pick(v.key)}
                disabled={solved || isWrong}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isRight
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-700"
                    : isWrong
                      ? "border-rose-500/50 bg-rose-500/10 text-rose-700 line-through"
                      : "border-foreground/12 hover:border-foreground/30"
                } ${solved || isWrong ? "cursor-default" : "cursor-pointer"}`}
              >
                {v.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {solved ? (
            <motion.div
              key="ok"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/[0.07] p-3 text-sm text-foreground/80"
            >
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <span>{ex.why}</span>
            </motion.div>
          ) : lastWrong ? (
            <motion.div
              key={`no-${wrong.length}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex gap-2 rounded-xl border border-rose-500/40 bg-rose-500/[0.07] p-3 text-sm text-foreground/80"
            >
              <X className="mt-0.5 size-4 shrink-0 text-rose-600" />
              <span>{WRONG_HINT[ex.answer]} Попробуйте ещё раз.</span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {solved ? (
          <button
            type="button"
            onClick={next}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
          >
            {index + 1 >= examples.length ? "Итог" : "Дальше"}
            <ArrowRight className="size-4" />
          </button>
        ) : null}
      </div>
    );
  }

  if (stage === "quizDone") {
    return (
      <div className="rounded-2xl border border-foreground/10 bg-background p-4 sm:p-6">
        {header}
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 text-sm text-foreground/80">
          <p className="font-bold">
            С первого раза: {firstTry} из {EXAMPLES.length}
          </p>
          <p className="mt-2">
            «Хочу много денег» — мечта. Цель по SMART — конкретная, измеримая (с какого до какого), достижимая,
            совместимая с ситуацией и с датой: «увеличить заработок с 600 до 700 $ в месяц к 5 апреля». SMART работает
            на короткой дистанции: 5000 $ при 500 $ — цель на год-два, а не на месяц.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStage("own")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
          >
            Шаг 2: своя цель
            <ArrowRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={restart}
            className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-4 py-2 text-sm font-semibold text-foreground/70 transition-colors hover:bg-foreground/5"
          >
            <RefreshCw className="size-4" />
            Пройти заново
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-4 sm:p-6">
      {withQuiz ? (
        <>
          <h3 className="font-bold">Шаг 2. Ваша цель по SMART</h3>
          <p className="mt-1 text-sm text-foreground/65">
            Запишите свою цель и проверьте её по 5 критериям. Кольцо мишени закрывается, когда критерий выполнен.
          </p>
        </>
      ) : (
        header
      )}

      <div className="mt-5 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="min-w-0">
          <label className="text-xs font-medium text-foreground/55" htmlFor="smart-goal">
            Ваша цель
          </label>
          <input
            id="smart-goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder={data.goalPlaceholder ?? "Например: увеличить продажи отдела"}
            className="mb-4 mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-brand"
          />

          <ul className="space-y-2.5">
            {CRITERIA.map((c) => {
              const value = answers[c.key] ?? "";
              const on = c.test(value);
              const showFix = !on && value.trim().length > 0;
              return (
                <li key={c.key} className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${
                      on ? "bg-amber-500 text-white" : "bg-foreground/10 text-foreground/50"
                    }`}
                  >
                    {on ? <Check className="size-3.5" /> : c.letter}
                  </span>
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`smart-${c.key}`} className="text-xs font-semibold text-foreground/70">
                      {c.letter} — {c.label}
                    </label>
                    <input
                      id={`smart-${c.key}`}
                      value={value}
                      onChange={(e) => setAnswers((p) => ({ ...p, [c.key]: e.target.value }))}
                      placeholder={c.hint}
                      aria-invalid={showFix || undefined}
                      className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-1.5 text-sm outline-none focus:border-brand"
                    />
                    {showFix ? <p className="mt-1 text-xs text-amber-700">{c.fix}</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Мишень */}
        <div className="flex flex-col items-center gap-2 justify-self-center">
          <svg viewBox="0 0 200 200" className="h-44 w-44" role="img" aria-label={`Мишень SMART: ${passed} из 5`}>
            {RINGS.map((r, i) => {
              const on = i < passed;
              return (
                <motion.circle
                  key={r}
                  cx="100"
                  cy="100"
                  r={r}
                  fill="none"
                  strokeWidth="12"
                  className={on ? "stroke-amber-500" : "stroke-foreground/10"}
                  initial={false}
                  animate={{ opacity: on ? 1 : 0.5, scale: on ? 1 : 0.98 }}
                  style={{ transformOrigin: "100px 100px" }}
                />
              );
            })}
            {/* Яблочко — пятый критерий */}
            <motion.circle
              cx="100"
              cy="100"
              r="12"
              className={passed >= 5 ? "fill-red-500" : "fill-foreground/15"}
              initial={false}
              animate={{ scale: done && !reduce ? [1, 1.35, 1] : 1 }}
              transition={{ duration: 0.5 }}
              style={{ transformOrigin: "100px 100px" }}
            />
            {/* Стрела в центр при полной цели */}
            {done ? (
              <motion.g
                initial={reduce ? false : { x: 60, y: -60, opacity: 0 }}
                animate={{ x: 0, y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 18 }}
              >
                <line x1="100" y1="100" x2="150" y2="50" stroke="currentColor" strokeWidth="3" className="text-foreground" />
                <polygon points="100,100 108,102 102,108" fill="currentColor" className="text-foreground" />
              </motion.g>
            ) : null}
          </svg>
          <span className="text-xs font-semibold text-foreground/50">{passed} / 5 критериев</span>
        </div>
      </div>

      {done ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700"
        >
          🎯 Цель по SMART готова — она конкретная, измеримая и с дедлайном. Такую уже можно взять в работу.
        </motion.div>
      ) : (
        <p className="mt-4 text-xs text-foreground/45">
          Заполните цель и все 5 критериев — мишень соберётся, а стрела попадёт в яблочко.
        </p>
      )}

      {withQuiz ? (
        <button
          type="button"
          onClick={restart}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/55 transition-colors hover:text-foreground/80"
        >
          <RefreshCw className="size-3.5" />
          Пройти заново
        </button>
      ) : null}
    </div>
  );
}

// Подсказка после ошибки — по верному ответу: на какой критерий урока смотреть.
const WRONG_HINT: Record<Verdict, string> = {
  dream: "Есть ли здесь «с какого до какого» и дата? Без них это ещё не цель.",
  smart: "Пройдитесь по критериям: что именно, с какого до какого, реально ли, нужно ли сейчас, к какой дате.",
  far: "Цифры здесь есть. А реально ли это за такой срок?",
};
