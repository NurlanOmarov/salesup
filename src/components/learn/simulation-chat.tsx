"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Send,
  User,
  UserRound,
  Flag,
  RefreshCw,
  Target,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ThumbsUp,
  Lightbulb,
} from "lucide-react";

/**
 * Тренажёр-симулятор диалога (S-интерактив для продаж): ученик ведёт переписку с
 * AI-клиентом, который отыгрывает персону/архетип сценария. По кнопке «Завершить» —
 * scorecard по фазам визита + compliance-флаги. Лимит реплик в день — на сервере
 * (AiUsageDay.simulations).
 */

interface ScenarioInfo {
  id: string;
  title: string;
  persona: string;
  objectives: string[];
}

interface Msg {
  role: "student" | "client";
  text: string;
}

interface PhaseScore {
  phase: string;
  label: string;
  score: number;
  comment: string;
}

interface ComplianceFlag {
  severity: "fail" | "warn";
  rule: string;
  quote: string;
  explanation: string;
}

interface Scorecard {
  phases: PhaseScore[];
  overallPct: number;
  passed: boolean;
  complianceFlags: ComplianceFlag[];
  strengths: string[];
  improvements: string[];
  topTip: string;
}

/** Цвет полоски фазы по порогу. */
function phaseColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-rose-500";
}

export function SimulationChat({ scenario }: { scenario: ScenarioInfo }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [card, setCard] = useState<Scorecard | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending, card]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || pending || card) return;
    const history: Msg[] = [...messages, { role: "student", text: q }];
    setMessages(history);
    setInput("");
    setPending(true);
    try {
      const res = await fetch("/api/ai/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: scenario.id, history }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages((m) => [...m, { role: "client", text: data.reply }]);
      if (typeof data.remaining === "number") setRemaining(data.remaining);
    } catch {
      setMessages((m) => [...m, { role: "client", text: "(клиент задумался — попробуйте ещё раз)" }]);
    } finally {
      setPending(false);
    }
  }

  async function finish() {
    if (pending || messages.length < 2) return;
    setPending(true);
    try {
      const res = await fetch("/api/ai/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: scenario.id, history: messages, finish: true }),
      });
      if (!res.ok) throw new Error();
      setCard(await res.json());
    } catch {
      setCard({
        phases: [],
        overallPct: 0,
        passed: false,
        complianceFlags: [],
        strengths: [],
        improvements: [],
        topTip: "Не удалось сформировать разбор. Попробуйте позже.",
      });
    } finally {
      setPending(false);
    }
  }

  function restart() {
    setMessages([]);
    setCard(null);
    setInput("");
  }

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-4 sm:p-5">
      {/* Бриф сценария */}
      <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.05] p-3">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-sky-600">
          <Target className="size-3.5" />
          Сценарий: {scenario.title}
        </p>
        <p className="mt-1 text-sm text-foreground/75">{scenario.persona}</p>
        {scenario.objectives.length > 0 ? (
          <ul className="mt-2 space-y-0.5 text-xs text-foreground/55">
            {scenario.objectives.map((o, i) => (
              <li key={i}>• {o}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Лента диалога */}
      <div ref={scrollRef} className="mt-3 max-h-[44vh] space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-foreground/45">
            Начните диалог — поздоровайтесь и установите контакт с клиентом.
          </p>
        ) : null}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "student" ? "flex-row-reverse" : ""}`}>
            <span
              className={[
                "flex size-8 shrink-0 items-center justify-center rounded-full",
                m.role === "student" ? "bg-amber-500/15 text-amber-600" : "bg-sky-500/15 text-sky-600",
              ].join(" ")}
            >
              {m.role === "student" ? <UserRound className="size-4" /> : <User className="size-4" />}
            </span>
            <div
              className={[
                "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                m.role === "student" ? "bg-amber-500/10 text-foreground" : "bg-foreground/[0.05] text-foreground/85",
              ].join(" ")}
            >
              {m.text}
            </div>
          </div>
        ))}
        {pending && !card ? (
          <motion.p
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            transition={{ repeat: Infinity, repeatType: "reverse", duration: 0.7 }}
            className="text-sm text-foreground/45"
          >
            Клиент печатает…
          </motion.p>
        ) : null}
      </div>

      {/* Разбор (scorecard) или ввод */}
      {card ? (
        <div className="mt-4 space-y-3">
          {/* Итоговый бейдж */}
          <div
            className={[
              "flex items-center gap-3 rounded-xl border p-4",
              card.passed
                ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                : "border-rose-500/35 bg-rose-500/[0.07]",
            ].join(" ")}
          >
            {card.passed ? (
              <ShieldCheck className="size-7 shrink-0 text-emerald-500" />
            ) : (
              <ShieldAlert className="size-7 shrink-0 text-rose-500" />
            )}
            <div>
              <p className="text-2xl font-bold leading-none">{card.overallPct}/100</p>
              <p className={`mt-1 text-sm font-medium ${card.passed ? "text-emerald-600" : "text-rose-600"}`}>
                {card.passed ? "Визит зачтён" : "Не зачтено — есть нарушения требований"}
              </p>
            </div>
          </div>

          {/* Полоски по фазам */}
          {card.phases.length > 0 ? (
            <div className="space-y-2.5 rounded-xl border border-foreground/10 p-4">
              {card.phases.map((p, i) => (
                <div key={p.phase}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium text-foreground/85">{p.label}</span>
                    <span className="tabular-nums text-foreground/55">{p.score}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${p.score}%` }}
                      transition={{ delay: i * 0.08, duration: 0.5, ease: "easeOut" }}
                      className={`h-full rounded-full ${phaseColor(p.score)}`}
                    />
                  </div>
                  {p.comment ? <p className="mt-1 text-xs text-foreground/55">{p.comment}</p> : null}
                </div>
              ))}
            </div>
          ) : null}

          {/* Compliance-флаги */}
          {card.complianceFlags.map((f, i) => (
            <div
              key={i}
              className={[
                "rounded-xl border p-3",
                f.severity === "fail"
                  ? "border-rose-500/35 bg-rose-500/[0.06]"
                  : "border-amber-500/30 bg-amber-500/[0.06]",
              ].join(" ")}
            >
              <p
                className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${
                  f.severity === "fail" ? "text-rose-600" : "text-amber-600"
                }`}
              >
                <AlertTriangle className="size-3.5" />
                {f.severity === "fail" ? "Нарушение" : "Внимание"}: {f.rule}
              </p>
              {f.quote ? <p className="mt-1 text-sm italic text-foreground/70">«{f.quote}»</p> : null}
              {f.explanation ? <p className="mt-1 text-sm text-foreground/80">{f.explanation}</p> : null}
            </div>
          ))}

          {/* Сильные стороны / зоны роста */}
          {(card.strengths.length > 0 || card.improvements.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {card.strengths.length > 0 ? (
                <div className="rounded-xl border border-foreground/10 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-emerald-600">
                    <ThumbsUp className="size-3.5" />
                    Сильные стороны
                  </p>
                  <ul className="mt-1.5 space-y-1 text-sm text-foreground/75">
                    {card.strengths.map((s, i) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {card.improvements.length > 0 ? (
                <div className="rounded-xl border border-foreground/10 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-amber-600">
                    <Lightbulb className="size-3.5" />
                    Зоны роста
                  </p>
                  <ul className="mt-1.5 space-y-1 text-sm text-foreground/75">
                    {card.improvements.map((s, i) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}

          {/* Главный совет */}
          {card.topTip ? (
            <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.05] p-3 text-sm text-foreground/85">
              <span className="font-semibold text-sky-600">Совет: </span>
              {card.topTip}
            </div>
          ) : null}

          <button
            onClick={restart}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
          >
            <RefreshCw className="size-4" />
            Пройти заново
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Ваша реплика клиенту…"
              disabled={pending}
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-foreground/20 bg-background px-3 py-2.5 text-sm outline-none focus:border-amber-500/50"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          </form>
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={finish}
              disabled={pending || messages.length < 2}
              className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-sm transition-colors hover:bg-foreground/5 disabled:opacity-40"
            >
              <Flag className="size-4" />
              Завершить и получить разбор
            </button>
            {remaining !== null ? (
              <span className="text-xs text-foreground/40">осталось реплик: {remaining}</span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
