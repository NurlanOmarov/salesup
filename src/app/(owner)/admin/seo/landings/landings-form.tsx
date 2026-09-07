"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { createLandingAction, updateLandingAction, deleteLandingAction } from "./actions";

export interface LandingRow {
  id: string;
  slug: string;
  cluster: string | null;
  title: string;
  description: string;
  h1: string;
  intro: string;
  body: string;
  courseId: string | null;
  keywords: string[];
  faqText: string;
  published: boolean;
  noindex: boolean;
  sortOrder: number;
}

export interface CourseOption {
  id: string;
  title: string;
}

const inputCls =
  "mt-1 block w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20";
const labelCls = "block text-xs font-medium text-foreground/70";

const EMPTY: Omit<LandingRow, "id"> = {
  slug: "",
  cluster: "",
  title: "",
  description: "",
  h1: "",
  intro: "",
  body: "",
  courseId: null,
  keywords: [],
  faqText: "",
  published: false,
  noindex: false,
  sortOrder: 0,
};

function Card({ row, courses }: { row: LandingRow | null; courses: CourseOption[] }) {
  const [form, setForm] = useState<Omit<LandingRow, "id">>(row ?? EMPTY);
  const [keywordsText, setKeywordsText] = useState((row?.keywords ?? []).join("\n"));
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setResult(null);
  };

  const save = () =>
    start(async () => {
      const payload = {
        slug: form.slug,
        cluster: form.cluster ?? "",
        title: form.title,
        description: form.description,
        h1: form.h1,
        intro: form.intro,
        body: form.body,
        courseId: form.courseId ?? "",
        keywords: keywordsText,
        faq: form.faqText,
        published: form.published,
        noindex: form.noindex,
        sortOrder: form.sortOrder,
      };
      const res = row
        ? await updateLandingAction({ id: row.id, ...payload })
        : await createLandingAction(payload);
      setResult(
        res.ok
          ? { ok: true, text: row ? "Сохранено" : "Создано" }
          : { ok: false, text: res.error },
      );
      if (res.ok && !row) {
        setForm(EMPTY);
        setKeywordsText("");
      }
    });

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Адрес страницы (slug)</label>
          <input
            className={inputCls}
            value={form.slug}
            placeholder="rabota-s-vozrazheniyami"
            onChange={(e) => set("slug", e.target.value)}
          />
          {row ? (
            <a
              href={`/obuchenie/${row.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-amber-600 hover:underline"
            >
              <ExternalLink className="size-3" />
              /obuchenie/{row.slug}
            </a>
          ) : null}
        </div>
        <div>
          <label className={labelCls}>Кластер (метка для себя)</label>
          <input
            className={inputCls}
            value={form.cluster ?? ""}
            placeholder="Возражения"
            onChange={(e) => set("cluster", e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4">
        <label className={labelCls}>Title — до 60–65 знаков, с гео или уточнением</label>
        <input className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} />
      </div>

      <div className="mt-4">
        <label className={labelCls}>Description — 140–200 знаков</label>
        <textarea
          rows={2}
          className={inputCls}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      <div className="mt-4">
        <label className={labelCls}>H1 — как человек формулирует запрос</label>
        <input className={inputCls} value={form.h1} onChange={(e) => set("h1", e.target.value)} />
      </div>

      <div className="mt-4">
        <label className={labelCls}>Вступление — прямой ответ на запрос, 2–3 предложения</label>
        <textarea
          rows={3}
          className={inputCls}
          value={form.intro}
          onChange={(e) => set("intro", e.target.value)}
        />
      </div>

      <div className="mt-4">
        <label className={labelCls}>Текст страницы (markdown, от 300 знаков)</label>
        <textarea
          rows={12}
          className={`${inputCls} font-mono text-xs`}
          value={form.body}
          onChange={(e) => set("body", e.target.value)}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Курс, на который ведём</label>
          <select
            className={inputCls}
            value={form.courseId ?? ""}
            onChange={(e) => set("courseId", e.target.value || null)}
          >
            <option value="">— каталог —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
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
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Ключи кластера — по одному в строке</label>
          <textarea
            rows={6}
            className={`${inputCls} font-mono text-xs`}
            value={keywordsText}
            onChange={(e) => {
              setKeywordsText(e.target.value);
              setResult(null);
            }}
          />
        </div>
        <div>
          <label className={labelCls}>FAQ — строка «вопрос :: ответ»</label>
          <textarea
            rows={6}
            className={`${inputCls} font-mono text-xs`}
            value={form.faqText}
            onChange={(e) => set("faqText", e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-amber-500"
            checked={form.published}
            onChange={(e) => set("published", e.target.checked)}
          />
          Опубликована
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-amber-500"
            checked={form.noindex}
            onChange={(e) => set("noindex", e.target.checked)}
          />
          Закрыть от индексации
        </label>

        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {row ? "Сохранить" : "Создать страницу"}
        </button>

        {row ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await deleteLandingAction({ id: row.id });
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-600/25 px-3 py-2 text-sm text-red-700 hover:bg-red-600/5"
          >
            <Trash2 className="size-4" />
            Удалить
          </button>
        ) : null}
      </div>

      {result ? (
        <p
          className={`mt-3 flex items-center gap-1.5 text-sm ${
            result.ok ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {result.ok ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <AlertCircle className="size-4" />
          )}
          {result.text}
        </p>
      ) : null}
    </div>
  );
}

/** Список посадочных + форма создания новой. */
export function LandingsForm({
  rows,
  courses,
}: {
  rows: LandingRow[];
  courses: CourseOption[];
}) {
  return (
    <div className="mt-6 space-y-5">
      <Card row={null} courses={courses} />
      {rows.map((r) => (
        <Card key={r.id} row={r} courses={courses} />
      ))}
    </div>
  );
}
