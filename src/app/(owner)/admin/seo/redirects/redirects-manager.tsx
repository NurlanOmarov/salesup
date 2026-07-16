"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2, ArrowRight } from "lucide-react";
import { createRedirectAction, deleteRedirectAction } from "../actions";

interface RedirectRow {
  id: string;
  from: string;
  to: string;
  hits: number;
}

const inputCls =
  "block w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20";

export function RedirectsManager({
  redirects,
}: {
  redirects: RedirectRow[];
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const res = await createRedirectAction({ from, to });
      if (res.ok) {
        setFrom("");
        setTo("");
      } else {
        setError(res.error);
      }
    });
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      await deleteRedirectAction({ id });
      setDeletingId(null);
    });
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Форма добавления */}
      <div className="rounded-2xl border border-foreground/10 bg-background p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label className="block text-sm font-medium text-foreground/80" htmlFor="from">
              Откуда (старый путь)
            </label>
            <input
              id="from"
              className={`mt-1 ${inputCls}`}
              placeholder="/courses/staryj-slug"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground/80" htmlFor="to">
              Куда (новый путь или URL)
            </label>
            <input
              id="to"
              className={`mt-1 ${inputCls}`}
              placeholder="/courses/novyj-slug"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={pending || !from || !to}
            className="inline-flex h-[38px] items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
          >
            {pending && !deletingId ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Добавить
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>

      {/* Список */}
      {redirects.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-foreground/15 p-8 text-center text-sm text-foreground/50">
          Редиректов пока нет.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-foreground/10">
          <table className="w-full text-sm">
            <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-foreground/50">
              <tr>
                <th className="px-4 py-2 font-medium">Откуда</th>
                <th className="px-4 py-2 font-medium">Куда</th>
                <th className="px-4 py-2 text-right font-medium">Срабатываний</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {redirects.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.from}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground/70">
                      <ArrowRight className="size-3 text-foreground/30" />
                      {r.to}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-foreground/60">
                    {r.hits}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      disabled={pending}
                      className="inline-flex items-center rounded-md p-1.5 text-foreground/40 transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50"
                      aria-label="Удалить"
                    >
                      {deletingId === r.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
