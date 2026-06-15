"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, AlertTriangle, Trophy, RefreshCw, User, Headset } from "lucide-react";
import type { DialogueAuditData } from "@/lib/interactive";

/**
 * Тренажёр «найди ошибку»: показан диалог менеджера с клиентом, ученик отмечает
 * реплики менеджера, в которых видит ошибку, затем проверяет себя с разбором.
 * Без записи на сервер: развивает насмотренность на типичные промахи в продажах.
 */
export function DialogueAudit({ data }: { data: DialogueAuditData }) {
  const lines = data.items;
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [checked, setChecked] = useState(false);

  const managerIdx = lines.map((l, i) => (l.speaker === "manager" ? i : -1)).filter((i) => i >= 0);
  const totalErrors = managerIdx.filter((i) => lines[i]!.error).length;

  const toggle = (i: number) => {
    if (checked) return;
    setMarked((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  // Счёт: верно отмеченные ошибки минус ложные срабатывания.
  const hits = [...marked].filter((i) => lines[i]!.error).length;
  const falsePos = [...marked].filter((i) => !lines[i]!.error).length;
  const score = Math.max(0, hits - falsePos);

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-4 sm:p-5">
      <p className="font-semibold">Найдите ошибки менеджера</p>
      <p className="mt-0.5 text-sm text-foreground/55">
        Отметьте реплики менеджера, в которых видите промах, затем нажмите «Проверить».
      </p>

      <div className="mt-4 space-y-2.5">
        {lines.map((l, i) => {
          const isManager = l.speaker === "manager";
          const isMarked = marked.has(i);
          const reveal = checked && isManager;
          return (
            <div key={i} className={isManager ? "" : "opacity-90"}>
              <button
                onClick={() => (isManager ? toggle(i) : undefined)}
                disabled={!isManager || checked}
                className={[
                  "flex w-full items-start gap-2.5 rounded-2xl border p-3 text-left text-sm transition-colors",
                  !isManager ? "border-foreground/10 bg-foreground/[0.03]" : "",
                  isManager && !checked && isMarked ? "border-amber-500/50 bg-amber-500/[0.08]" : "",
                  isManager && !checked && !isMarked ? "border-foreground/15 hover:border-amber-500/30" : "",
                  reveal && l.error ? "border-rose-500/40 bg-rose-500/[0.07]" : "",
                  reveal && !l.error ? "border-emerald-500/30 bg-emerald-500/[0.05]" : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
                    isManager ? "bg-sky-500/15 text-sky-600" : "bg-foreground/10 text-foreground/50",
                  ].join(" ")}
                >
                  {isManager ? <Headset className="size-4" /> : <User className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-foreground/40">
                    {isManager ? "Менеджер" : "Клиент"}
                  </span>
                  <span className="text-foreground/85">{l.text}</span>
                </span>
                {/* Индикатор отметки/результата */}
                {isManager ? (
                  reveal ? (
                    l.error ? (
                      <AlertTriangle className="size-4 shrink-0 text-rose-600" />
                    ) : (
                      <Check className="size-4 shrink-0 text-emerald-600" />
                    )
                  ) : isMarked ? (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-slate-950">
                      ✓
                    </span>
                  ) : (
                    <span className="size-5 shrink-0 rounded-full border border-foreground/25" />
                  )
                ) : null}
              </button>
              <AnimatePresence>
                {reveal && l.explanation ? (
                  <motion.p
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="overflow-hidden pl-12 pt-1.5 text-xs text-foreground/60"
                  >
                    {l.error ? "Ошибка: " : "Верно: "}
                    {l.explanation}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <div className="mt-5">
        {!checked ? (
          <button
            onClick={() => setChecked(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
          >
            Проверить
          </button>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-foreground/[0.04] px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              {score === totalErrors && falsePos === 0 ? (
                <Trophy className="size-4 text-amber-500" />
              ) : null}
              Найдено {hits} из {totalErrors} ошибок
              {falsePos > 0 ? <span className="text-rose-600"> · ложных {falsePos}</span> : null}
            </span>
            <button
              onClick={() => {
                setMarked(new Set());
                setChecked(false);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-foreground/55 hover:text-foreground"
            >
              <RefreshCw className="size-3.5" />
              Заново
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
