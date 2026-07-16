"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2, ArrowRight, FileWarning, CornerUpRight, EyeOff, Pencil, X } from "lucide-react";
import {
  createRedirectAction,
  updateRedirectAction,
  deleteRedirectAction,
  deleteNotFoundHitAction,
} from "../actions";

interface RedirectRow {
  id: string;
  from: string;
  to: string;
  hits: number;
}

interface NotFoundRow {
  id: string;
  path: string;
  hits: number;
  lastSeenAt: string; // ISO
}

const inputCls =
  "block w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20";

export function RedirectsManager({
  redirects,
  notFound,
}: {
  redirects: RedirectRow[];
  notFound: NotFoundRow[];
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function resetForm() {
    setFrom("");
    setTo("");
    setEditingId(null);
    setError(null);
  }

  /** Создание нового правила или сохранение редактируемого (одна форма на оба режима). */
  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const res = editingId
        ? await updateRedirectAction({ id: editingId, from, to })
        : await createRedirectAction({ from, to });
      if (res.ok) resetForm();
      else setError(res.error);
    });
  }

  /** Редактировать правило: подставляет значения в форму. */
  function startEdit(r: RedirectRow) {
    setEditingId(r.id);
    setFrom(r.from);
    setTo(r.to);
    setError(null);
    document.getElementById("from")?.focus();
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      await deleteRedirectAction({ id });
      setDeletingId(null);
    });
  }

  /** «Создать редирект» из строки 404: подставляет путь в форму. */
  function fillFrom(path: string) {
    setFrom(path);
    setError(null);
    document.getElementById("from")?.focus();
  }

  function hideNotFound(id: string) {
    startTransition(async () => {
      await deleteNotFoundHitAction({ id });
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending || !from || !to}
              className="inline-flex h-[38px] items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
            >
              {pending && !deletingId ? (
                <Loader2 className="size-4 animate-spin" />
              ) : editingId ? (
                <Pencil className="size-4" />
              ) : (
                <Plus className="size-4" />
              )}
              {editingId ? "Сохранить" : "Добавить"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex h-[38px] items-center justify-center rounded-lg border border-foreground/15 px-3 text-sm text-foreground/60 transition-colors hover:bg-foreground/5"
                aria-label="Отменить редактирование"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
        {editingId ? (
          <p className="mt-2 text-xs text-foreground/50">
            Редактирование правила: цепочки схлопываются автоматически, циклы не дадут
            сохранить.
          </p>
        ) : null}
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
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        disabled={pending}
                        className="inline-flex items-center rounded-md p-1.5 text-foreground/40 transition-colors hover:bg-amber-500/10 hover:text-amber-700 disabled:opacity-50"
                        aria-label="Редактировать"
                      >
                        <Pencil className="size-4" />
                      </button>
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Журнал 404 — по нему создаются редиректы */}
      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
          <FileWarning className="size-4 text-amber-500" />
          Журнал 404 ({notFound.length})
        </h2>
        <p className="mt-1 text-xs text-foreground/50">
          Несуществующие адреса, которые запрашивали посетители/боты (топ по количеству).
          Создание редиректа убирает путь из журнала.
        </p>
        {notFound.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-foreground/15 p-6 text-center text-sm text-foreground/50">
            Битых адресов не зафиксировано.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-foreground/10">
            <table className="w-full text-sm">
              <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-foreground/50">
                <tr>
                  <th className="px-4 py-2 font-medium">Путь</th>
                  <th className="px-4 py-2 text-right font-medium">Запросов</th>
                  <th className="px-4 py-2 font-medium">Последний</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {notFound.map((n) => (
                  <tr key={n.id}>
                    <td className="px-4 py-2.5 font-mono text-xs">{n.path}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground/60">
                      {n.hits}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-foreground/50">
                      {new Date(n.lastSeenAt).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => fillFrom(n.path)}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/5 px-2 py-1 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-500/10"
                        >
                          <CornerUpRight className="size-3" />
                          Редирект
                        </button>
                        <button
                          type="button"
                          onClick={() => hideNotFound(n.id)}
                          disabled={pending}
                          className="rounded-md p-1.5 text-foreground/40 transition-colors hover:bg-foreground/5 hover:text-foreground/70 disabled:opacity-50"
                          aria-label="Скрыть из журнала"
                          title="Скрыть из журнала"
                        >
                          <EyeOff className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
