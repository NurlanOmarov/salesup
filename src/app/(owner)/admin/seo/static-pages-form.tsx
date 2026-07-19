"use client";

import { useState, useTransition } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { updateStaticPageSeoAction, draftStaticPageAction } from "./actions";
import { CharCounter, TITLE_LIMIT, DESC_LIMIT } from "./serp-preview";

/**
 * SEO статических страниц (каталог, оферта, политика): title/description/noindex,
 * для thin-страниц — markdown-текст с AI-черновиком (Sonnet, по кнопке).
 * Пустые поля → фолбэки страницы (показаны в placeholder).
 */

export interface StaticPageFormRow {
  path: string;
  label: string;
  hasBody: boolean;
  fallbackTitle: string;
  fallbackDescription: string;
  title: string; // сохранённый override или ""
  description: string;
  noindex: boolean; // эффективное значение (row либо дефолт страницы)
  body: string;
}

const inputCls =
  "mt-1 block w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20";
const labelCls = "block text-sm font-medium text-foreground/80";

function PageCard({ page }: { page: StaticPageFormRow }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(page.title);
  const [description, setDescription] = useState(page.description);
  const [noindex, setNoindex] = useState(page.noindex);
  const [body, setBody] = useState(page.body);

  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [aiPending, setAiPending] = useState(false);

  function handleSave() {
    setResult(null);
    startTransition(async () => {
      const res = await updateStaticPageSeoAction({
        path: page.path,
        title,
        description,
        noindex,
        body,
      });
      setResult(
        res.ok ? { ok: true, text: "Сохранено" } : { ok: false, text: res.error },
      );
    });
  }

  async function handleAiDraft() {
    setResult(null);
    setAiPending(true);
    const res = await draftStaticPageAction({ path: page.path });
    setAiPending(false);
    if (res.ok) setBody(res.data.body);
    else setResult({ ok: false, text: res.error });
  }

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="font-medium">{page.label}</span>
          <span className="font-mono text-xs text-foreground/40">{page.path}</span>
          {noindex ? (
            <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] text-foreground/60">
              noindex
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-foreground/10 p-4">
          <div>
            <div className="flex items-center justify-between">
              <label className={labelCls} htmlFor={`t-${page.path}`}>
                SEO-заголовок (title)
              </label>
              <CharCounter value={title} limit={TITLE_LIMIT} />
            </div>
            <input
              id={`t-${page.path}`}
              className={inputCls}
              placeholder={page.fallbackTitle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className={labelCls} htmlFor={`d-${page.path}`}>
                Meta description
              </label>
              <CharCounter value={description} limit={DESC_LIMIT} />
            </div>
            <textarea
              id={`d-${page.path}`}
              rows={2}
              className={inputCls}
              placeholder={page.fallbackDescription}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {page.hasBody ? (
            <div>
              <div className="flex items-center justify-between">
                <label className={labelCls} htmlFor={`b-${page.path}`}>
                  Текст страницы (markdown)
                </label>
                <button
                  type="button"
                  onClick={handleAiDraft}
                  disabled={aiPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/5 px-2.5 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/10 disabled:opacity-50 dark:text-amber-400"
                >
                  {aiPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  AI-черновик текста
                </button>
              </div>
              <textarea
                id={`b-${page.path}`}
                rows={12}
                className={`${inputCls} font-mono text-xs`}
                placeholder="Пусто → на странице заглушка «текст будет добавлен»"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <p className="mt-1 text-xs text-foreground/40">
                Черновик — не юридическая консультация: проверьте текст (в идеале — с
                юристом), заполните реквизиты вместо «[указать …]» и снимите noindex.
              </p>
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-sm text-foreground/80">
            <input
              type="checkbox"
              checked={noindex}
              onChange={(e) => setNoindex(e.target.checked)}
              className="size-4 rounded border-foreground/20 accent-amber-500"
            />
            Не индексировать (noindex)
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Сохранить
            </button>
            <a
              href={page.path}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-foreground/50 transition-colors hover:text-amber-700"
            >
              <ExternalLink className="size-3.5" />
              Открыть страницу
            </a>
            {result && (
              <span
                className={`inline-flex items-center gap-1.5 text-sm ${
                  result.ok ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {result.ok ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <AlertCircle className="size-4" />
                )}
                {result.text}
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function StaticPagesForm({ pages }: { pages: StaticPageFormRow[] }) {
  return (
    <div className="mt-3 space-y-3">
      {pages.map((p) => (
        <PageCard key={p.path} page={p} />
      ))}
    </div>
  );
}
