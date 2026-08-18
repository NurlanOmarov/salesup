"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2, Plus, CheckCircle2, AlertCircle } from "lucide-react";
import {
  createExternalReviewAction,
  updateExternalReviewAction,
  deleteExternalReviewAction,
} from "./actions";

export interface ExternalReviewRow {
  id: string;
  source: "YANDEX" | "GOOGLE" | "OTHER";
  author: string;
  text: string;
  rating: number | null;
  url: string | null;
  sortOrder: number;
  published: boolean;
}

const inputCls =
  "mt-1 block w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20";
const labelCls = "block text-xs font-medium text-foreground/70";

const EMPTY: Omit<ExternalReviewRow, "id"> = {
  source: "YANDEX",
  author: "",
  text: "",
  rating: null,
  url: null,
  sortOrder: 0,
  published: true,
};

/** Одна карточка: и создание нового отзыва, и правка существующего. */
function ReviewCard({ row }: { row: ExternalReviewRow | null }) {
  const [form, setForm] = useState<Omit<ExternalReviewRow, "id">>(row ?? EMPTY);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setResult(null);
  };

  const save = () =>
    start(async () => {
      const payload = { ...form, url: form.url || undefined };
      const res = row
        ? await updateExternalReviewAction({ id: row.id, ...payload })
        : await createExternalReviewAction(payload);
      setResult(
        res.ok
          ? { ok: true, text: row ? "Сохранено" : "Добавлено" }
          : { ok: false, text: res.error },
      );
      if (res.ok && !row) setForm(EMPTY);
    });

  const remove = () =>
    start(async () => {
      if (!row) return;
      const res = await deleteExternalReviewAction({ id: row.id });
      if (!res.ok) setResult({ ok: false, text: res.error });
    });

  return (
    <div className="rounded-xl border border-foreground/10 bg-background p-4">
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr_6rem]">
        <div>
          <label className={labelCls}>Площадка</label>
          <select
            className={inputCls}
            value={form.source}
            onChange={(e) => set("source", e.target.value as ExternalReviewRow["source"])}
          >
            <option value="YANDEX">Яндекс Карты</option>
            <option value="GOOGLE">Google Карты</option>
            <option value="OTHER">Другая</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Автор — как подписан на площадке</label>
          <input
            className={inputCls}
            value={form.author}
            placeholder="Ирина К."
            onChange={(e) => set("author", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Оценка на площадке</label>
          <select
            className={inputCls}
            value={form.rating ?? ""}
            onChange={(e) => set("rating", e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">не указана</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label className={labelCls}>Текст отзыва</label>
        <textarea
          rows={4}
          className={`${inputCls} text-xs`}
          value={form.text}
          placeholder="Скопируйте текст с карточки организации без правок"
          onChange={(e) => set("text", e.target.value)}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_6rem_8rem]">
        <div>
          <label className={labelCls}>Ссылка на отзыв (проверяемость)</label>
          <input
            className={inputCls}
            value={form.url ?? ""}
            placeholder="https://yandex.by/maps/org/…"
            onChange={(e) => set("url", e.target.value || null)}
          />
        </div>
        <div>
          <label className={labelCls}>Порядок</label>
          <input
            type="number"
            className={inputCls}
            value={form.sortOrder}
            onChange={(e) => set("sortOrder", Number(e.target.value) || 0)}
          />
        </div>
        <label className="mt-6 flex items-center gap-2 text-sm text-foreground/80">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => set("published", e.target.checked)}
            className="size-4 rounded border-foreground/20 accent-amber-500"
          />
          Показывать
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : row ? null : <Plus className="size-4" />}
          {row ? "Сохранить" : "Добавить отзыв"}
        </button>
        {row ? (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-2 text-sm text-foreground/60 transition-colors hover:border-red-400/60 hover:text-red-600"
          >
            <Trash2 className="size-4" />
            Удалить
          </button>
        ) : null}
        {result ? (
          <span
            className={`inline-flex items-center gap-1.5 text-sm ${result.ok ? "text-emerald-600" : "text-red-600"}`}
          >
            {result.ok ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
            {result.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function ExternalReviewsForm({ rows }: { rows: ExternalReviewRow[] }) {
  return (
    <div className="mt-4 space-y-4">
      <ReviewCard row={null} />
      {rows.map((r) => (
        <ReviewCard key={r.id} row={r} />
      ))}
    </div>
  );
}
