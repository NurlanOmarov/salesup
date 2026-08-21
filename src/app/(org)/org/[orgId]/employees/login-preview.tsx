"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { formatLogin } from "@/lib/org/seats";

const SHOWN = 3;
const STEP_MS = 900;
const HOLD_MS = 2200;

/**
 * Зацикленная подсказка: показывает, откуда берутся логины работников.
 *
 * Экран создания оперирует только числом («сколько работников»), а имена
 * появляются уже в результате — до нажатия кнопки неоткуда узнать, что учётка
 * называется не по фамилии, а кодом организации с порядковым номером. Это же
 * и есть обезличивание, поэтому объяснять его лучше до, а не после.
 */
export function LoginPreview({ orgSlug }: { orgSlug: string }) {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(reduced ? SHOWN : 0);

  useEffect(() => {
    if (reduced) return;
    const delay = step >= SHOWN ? HOLD_MS : STEP_MS;
    const t = window.setTimeout(
      () => setStep((s) => (s >= SHOWN ? 0 : s + 1)),
      delay,
    );
    return () => window.clearTimeout(t);
  }, [step, reduced]);

  const logins = Array.from({ length: SHOWN }, (_, i) => formatLogin(orgSlug, i + 1));

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-foreground/15 bg-foreground/[0.02] p-3">
      <div className="shrink-0">
        <p className="text-[11px] uppercase tracking-wide text-foreground/45">
          Код организации
        </p>
        <p className="font-mono text-sm">{orgSlug}</p>
      </div>

      <ArrowRight className="size-4 shrink-0 text-foreground/30" />

      <div className="min-w-44 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-foreground/45">
          Логины работников
        </p>
        <ul className="mt-1 flex min-h-16 flex-wrap gap-1.5">
          <AnimatePresence mode="popLayout">
            {logins.slice(0, step).map((login) => (
              <motion.li
                key={login}
                layout
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.28 }}
                className="h-fit rounded-lg border border-foreground/10 bg-background px-2.5 py-1 font-mono text-sm"
              >
                {login}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <p className="mt-1 text-xs text-foreground/50">
          Номер присваивается по порядку, ФИО платформа не спрашивает. Кто есть
          кто — видно только вам, через подписи.
        </p>
      </div>
    </div>
  );
}
