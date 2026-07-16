"use client";

import { Sparkles, Check, X, Undo2 } from "lucide-react";
import { CharCounter } from "./serp-preview";

/**
 * UX предложений AI: ничего не перезаписывается молча. Предложение показывается
 * карточкой «было → станет»; владелец жмёт «Применить» или «Отклонить», после
 * применения доступно «Вернуть как было» (снэпшот держит родительская форма).
 */

export interface SuggestionField {
  label: string;
  current: string;
  suggested: string;
  limit?: number;
}

export function AiSuggestionCard({
  fields,
  onApply,
  onDismiss,
}: {
  fields: SuggestionField[];
  onApply: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/[0.05] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400">
          <Sparkles className="size-4" />
          Предложение AI
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onApply}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-400"
          >
            <Check className="size-3.5" />
            Применить
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex items-center gap-1 rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-medium text-foreground/60 transition-colors hover:bg-foreground/5"
          >
            <X className="size-3.5" />
            Отклонить
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {fields.map((f) => (
          <div key={f.label} className="text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
              {f.label}
            </p>
            {f.current.trim() ? (
              <p className="mt-0.5 text-foreground/45 line-through decoration-foreground/30">
                {f.current}
              </p>
            ) : (
              <p className="mt-0.5 italic text-foreground/35">(было пусто)</p>
            )}
            <div className="mt-1 flex items-start justify-between gap-3">
              <p className="font-medium text-foreground">{f.suggested}</p>
              {f.limit ? <CharCounter value={f.suggested} limit={f.limit} /> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Кнопка «Вернуть как было» — показывается после применения предложения. */
export function UndoBar({ onUndo }: { onUndo: () => void }) {
  return (
    <button
      type="button"
      onClick={onUndo}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/50 underline-offset-2 hover:text-foreground hover:underline"
    >
      <Undo2 className="size-3.5" />
      Вернуть как было
    </button>
  );
}
