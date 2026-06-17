"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, UserRound, GitBranch, RefreshCw, Trophy, XCircle, Flag } from "lucide-react";
import type { BranchingData, BranchNode, BranchOutcome } from "@/lib/interactive";

/**
 * Тренажёр ветвящегося диалога: на каждом шаге ученик выбирает реплику, диалог
 * ветвится к разным узлам и в итоге приводит к исходу (успех/провал/нейтрально).
 * Тренирует принятие решений. Дерево готовится заранее (валидный граф), на рантайме
 * — чистая навигация без LLM (CLAUDE.md: один сервер, $0 токенов).
 */

interface Turn {
  npc: string; // реплика клиента в узле
  choice?: string; // выбранная реплика ученика
  note?: string; // микро-фидбек на выбор
}

const OUTCOME_STYLE: Record<BranchOutcome, { ring: string; text: string; label: string; icon: typeof Trophy }> = {
  win: { ring: "border-emerald-500/30 bg-emerald-500/[0.06]", text: "text-emerald-600", label: "Успех", icon: Trophy },
  lose: { ring: "border-rose-500/35 bg-rose-500/[0.07]", text: "text-rose-600", label: "Провал", icon: XCircle },
  neutral: { ring: "border-amber-500/30 bg-amber-500/[0.06]", text: "text-amber-600", label: "Итог", icon: Flag },
};

export function BranchingScenario({ data }: { data: BranchingData }) {
  const byId = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data.nodes]);
  const [currentId, setCurrentId] = useState(data.start);
  const [history, setHistory] = useState<Turn[]>([]);

  const node: BranchNode | undefined = byId.get(currentId);
  const choices = node?.choices ?? [];
  const terminal = !!node && choices.length === 0;

  function choose(text: string, to: string, note?: string) {
    if (!node) return;
    setHistory((h) => [...h, { npc: node.npc, choice: text, note }]);
    setCurrentId(to);
  }

  function restart() {
    setHistory([]);
    setCurrentId(data.start);
  }

  if (!node) return null;

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-4 sm:p-5">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-violet-600">
        <GitBranch className="size-3.5" />
        Ветвящийся сценарий{data.title ? `: ${data.title}` : ""}
      </p>

      {/* История пройденных шагов */}
      <div className="mt-3 space-y-3">
        {history.map((t, i) => (
          <div key={i} className="space-y-2">
            <Bubble role="client" text={t.npc} />
            {t.choice ? <Bubble role="student" text={t.choice} /> : null}
            {t.note ? (
              <p className="pl-11 text-xs text-foreground/50">{t.note}</p>
            ) : null}
          </div>
        ))}

        {/* Текущая реплика клиента */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Bubble role="client" text={node.npc} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Терминал: исход */}
      {terminal ? (
        <Outcome outcome={node.outcome ?? "neutral"} text={node.outcomeText} onRestart={restart} />
      ) : (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-foreground/70">Ваш ответ:</p>
          {choices.map((c, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => choose(c.text, c.to, c.note)}
              className="w-full rounded-xl border border-foreground/15 p-3 text-left text-sm transition-colors hover:border-violet-500/40 hover:bg-violet-500/[0.05]"
            >
              {c.text}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

function Bubble({ role, text }: { role: "client" | "student"; text: string }) {
  return (
    <div className={`flex gap-2.5 ${role === "student" ? "flex-row-reverse" : ""}`}>
      <span
        className={[
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          role === "student" ? "bg-amber-500/15 text-amber-600" : "bg-violet-500/15 text-violet-600",
        ].join(" ")}
      >
        {role === "student" ? <UserRound className="size-4" /> : <User className="size-4" />}
      </span>
      <div
        className={[
          "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
          role === "student" ? "bg-amber-500/10 text-foreground" : "bg-foreground/[0.05] text-foreground/85",
        ].join(" ")}
      >
        {text}
      </div>
    </div>
  );
}

function Outcome({
  outcome,
  text,
  onRestart,
}: {
  outcome: BranchOutcome;
  text?: string;
  onRestart: () => void;
}) {
  const s = OUTCOME_STYLE[outcome];
  const Icon = s.icon;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`mt-4 rounded-xl border p-4 text-center ${s.ring}`}
    >
      <Icon className={`mx-auto size-8 ${s.text}`} />
      <p className={`mt-2 font-bold ${s.text}`}>{s.label}</p>
      {text ? <p className="mt-1 text-sm text-foreground/75">{text}</p> : null}
      <button
        onClick={onRestart}
        className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-400"
      >
        <RefreshCw className="size-4" />
        Пройти заново
      </button>
    </motion.div>
  );
}
