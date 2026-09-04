import Link from "next/link";
import { ArrowRight, Check, CircleDot } from "lucide-react";
import type { SetupStep } from "@/lib/org/setup";
import { cn } from "@/lib/utils";

/**
 * Пошаговый запуск: что уже сделано, что делать сейчас, что будет дальше.
 *
 * Смысл блока — снять с человека необходимость помнить порядок действий и
 * искать нужный раздел. Поэтому раскрыт ровно один шаг — текущий: остальные
 * свёрнуты в строку, а выполненные уходят в серое с галочкой. Когда всё
 * обязательное сделано, блок схлопывается в одну строку и не отвлекает
 * (список остаётся доступным по клику).
 *
 * Состояние шагов считается из БД (lib/org/setup.ts), а не запоминается: шаг мог
 * закрыть другой человек — владелец за клиента или наоборот.
 */
export function SetupChecklist({
  title,
  intro,
  steps,
  doneTitle,
  doneBody,
}: {
  title: string;
  intro?: string;
  steps: SetupStep[];
  doneTitle: string;
  doneBody?: string;
}) {
  const required = steps.filter((s) => !s.optional);
  const doneCount = required.filter((s) => s.done).length;
  const allDone = doneCount === required.length;
  const current = steps.find((s) => !s.done && !s.optional);

  if (allDone) {
    return (
      <details className="group rounded-2xl border border-emerald-600/25 bg-emerald-500/5 p-4">
        <summary className="flex cursor-pointer list-none items-center gap-2.5 text-sm">
          <Check className="size-4 shrink-0 text-emerald-600" />
          <span className="font-semibold text-emerald-800">{doneTitle}</span>
          <span className="ml-auto text-xs text-foreground/50 group-open:hidden">
            показать шаги
          </span>
          <span className="ml-auto hidden text-xs text-foreground/50 group-open:inline">
            свернуть
          </span>
        </summary>
        {doneBody ? (
          <p className="mt-2 text-sm text-foreground/65">{doneBody}</p>
        ) : null}
        <ol className="mt-3 space-y-2">
          {steps.map((step, i) => (
            <StepRow key={step.key} step={step} index={i} state={step.done ? "done" : "next"} />
          ))}
        </ol>
      </details>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-600/25 bg-amber-500/5 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {/* Именно «готово N из M», а не «шаг N»: шаги закрываются не по порядку —
            коды мог создать клиент раньше, чем владелец дошёл до реквизитов. */}
        <p className="text-xs text-foreground/55">
          готово {doneCount} из {required.length}
        </p>
      </div>
      {intro ? <p className="mt-1 text-sm text-foreground/65">{intro}</p> : null}

      <ol className="mt-4 space-y-2">
        {steps.map((step, i) => (
          <StepRow
            key={step.key}
            step={step}
            index={i}
            state={step.done ? "done" : step.key === current?.key ? "current" : "next"}
          />
        ))}
      </ol>
    </section>
  );
}

function StepRow({
  step,
  index,
  state,
}: {
  step: SetupStep;
  index: number;
  state: "done" | "current" | "next";
}) {
  const current = state === "current";

  return (
    <li
      className={cn(
        "flex gap-3 rounded-xl px-3 py-2.5",
        current ? "border border-foreground/10 bg-background" : "",
      )}
    >
      <span className="mt-0.5 shrink-0">
        {state === "done" ? (
          <Check className="size-4 text-emerald-600" />
        ) : current ? (
          <CircleDot className="size-4 text-amber-600" />
        ) : (
          <span className="inline-flex size-4 items-center justify-center text-xs text-foreground/40">
            {index + 1}
          </span>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm",
            state === "done"
              ? "text-foreground/45 line-through decoration-foreground/20"
              : current
                ? "font-semibold"
                : "text-foreground/70",
          )}
        >
          {step.title}
          {step.optional ? (
            <span className="ml-2 rounded bg-foreground/[0.06] px-1.5 py-0.5 align-middle text-[11px] font-normal text-foreground/50">
              по желанию
            </span>
          ) : null}
        </p>

        {current ? (
          <>
            <p className="mt-1 text-sm text-foreground/70">{step.body}</p>
            {step.href ? (
              <Link
                href={step.href}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
              >
                {step.linkLabel ?? "Перейти"}
                <ArrowRight className="size-4" />
              </Link>
            ) : null}
          </>
        ) : null}
      </div>
    </li>
  );
}
