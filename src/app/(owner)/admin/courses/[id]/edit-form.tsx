"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Loader2, Upload, CheckCircle2, AlertCircle, Sparkles, Gauge } from "lucide-react";
import type { RatesMap } from "@/lib/currency";
import { coverPublicUrl } from "@/lib/utils";
import { updateCourseAction, uploadCoverAction } from "../actions";
import { generateMetaAction, scoreMetaAction } from "../../seo/actions";
import {
  SerpPreview,
  CharCounter,
  TITLE_LIMIT,
  DESC_LIMIT,
} from "../../seo/serp-preview";
import type { MetaScore } from "@/lib/seo/ai";

interface CourseFields {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  industry: string | null;
  description: string;
  coverUrl: string | null;
  priceTiyn: number;
  oldPriceTiyn: number | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  accessDuration:
    | "LIFETIME"
    | "MONTHS_1"
    | "MONTHS_3"
    | "MONTHS_6"
    | "MONTHS_12";
  sortOrder: number;
  hoursLabel: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  canonicalPath: string | null;
  focusKeyword: string | null;
  seoNoindex: boolean;
  certificateEnabled: boolean;
}

const SYMBOLS = { KZT: "₸", RUB: "₽", BYN: "Br" } as const;

// Зеркало округления lib/currency/format (ceil до 100 для RUB, до 10 для BYN).
function roundFor(amount: number, code: "KZT" | "RUB" | "BYN"): number {
  if (code === "RUB") return Math.ceil(amount / 100) * 100;
  if (code === "BYN") return Math.ceil(amount / 10) * 10;
  return amount;
}
function preview(
  kzt: number,
  code: "KZT" | "RUB" | "BYN",
  rates: RatesMap,
): string {
  if (code === "KZT") return `${kzt.toLocaleString("ru-RU")} ${SYMBOLS.KZT}`;
  const rate = rates[code];
  if (!rate || rate <= 0) return "—";
  const v = roundFor(kzt / rate, code);
  return `${Math.round(v).toLocaleString("ru-RU")} ${SYMBOLS[code]}`;
}

export function CourseEditForm({
  course,
  rates,
}: {
  course: CourseFields;
  rates: RatesMap;
}) {
  const [title, setTitle] = useState(course.title);
  const [subtitle, setSubtitle] = useState(course.subtitle ?? "");
  const [industry, setIndustry] = useState(course.industry ?? "");
  const [description, setDescription] = useState(course.description);
  const [priceKzt, setPriceKzt] = useState(course.priceTiyn / 100);
  const [oldPriceKzt, setOldPriceKzt] = useState(
    course.oldPriceTiyn ? course.oldPriceTiyn / 100 : 0,
  );
  const [status, setStatus] = useState(course.status);
  const [accessDuration, setAccessDuration] = useState(course.accessDuration);
  const [sortOrder, setSortOrder] = useState(course.sortOrder);
  const [hoursLabel, setHoursLabel] = useState(course.hoursLabel ?? "");
  const [seoTitle, setSeoTitle] = useState(course.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(
    course.seoDescription ?? "",
  );
  const [ogTitle, setOgTitle] = useState(course.ogTitle ?? "");
  const [ogDescription, setOgDescription] = useState(course.ogDescription ?? "");
  const [canonicalPath, setCanonicalPath] = useState(course.canonicalPath ?? "");
  const [focusKeyword, setFocusKeyword] = useState(course.focusKeyword ?? "");
  const [seoNoindex, setSeoNoindex] = useState(course.seoNoindex);
  const [certificateEnabled, setCertificateEnabled] = useState(
    course.certificateEnabled,
  );

  // AI-помощники SEO (черновик метаданных + оценка качества).
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [scorePending, setScorePending] = useState(false);
  const [score, setScore] = useState<MetaScore | null>(null);

  async function handleAiDraft() {
    setAiError(null);
    setAiPending(true);
    const res = await generateMetaAction({
      source: `${title}\n${subtitle}\n${description}`.trim(),
      focusKeyword: focusKeyword || undefined,
    });
    setAiPending(false);
    if (res.ok) {
      setSeoTitle(res.data.title);
      setSeoDescription(res.data.description);
    } else {
      setAiError(res.error);
    }
  }

  async function handleScore() {
    setAiError(null);
    setScore(null);
    setScorePending(true);
    const res = await scoreMetaAction({
      title: seoTitle || title,
      description: seoDescription || subtitle,
      focusKeyword: focusKeyword || undefined,
      source: description || undefined,
    });
    setScorePending(false);
    if (res.ok) setScore(res.data);
    else setAiError(res.error);
  }

  const [coverKey, setCoverKey] = useState(course.coverUrl);
  const [coverVersion, setCoverVersion] = useState(0);
  const [coverMsg, setCoverMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const coverSrc = coverPublicUrl(coverKey, course.id);

  function handleSave() {
    setResult(null);
    startTransition(async () => {
      const res = await updateCourseAction({
        id: course.id,
        title,
        subtitle,
        industry,
        description,
        priceKzt,
        oldPriceKzt,
        status,
        accessDuration,
        sortOrder,
        hoursLabel,
        seoTitle,
        seoDescription,
        ogTitle,
        ogDescription,
        canonicalPath,
        focusKeyword,
        seoNoindex,
        certificateEnabled,
      });
      setResult(
        res.ok
          ? { ok: true, text: "Сохранено" }
          : { ok: false, text: res.error },
      );
    });
  }

  async function handleCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverMsg(null);
    const fd = new FormData();
    fd.append("courseId", course.id);
    fd.append("file", file);
    const res = await uploadCoverAction(fd);
    if (res.ok) {
      setCoverKey(res.data.coverUrl);
      setCoverVersion((v) => v + 1);
      setCoverMsg({ ok: true, text: "Обложка обновлена" });
    } else {
      setCoverMsg({ ok: false, text: res.error });
    }
    e.target.value = "";
  }

  const inputCls =
    "mt-1 block w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20";
  const labelCls = "block text-sm font-medium text-foreground/80";

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Левая колонка — поля */}
      <div className="space-y-5 rounded-2xl border border-foreground/10 bg-background p-5">
        <div>
          <label className={labelCls} htmlFor="title">
            Название
          </label>
          <input
            id="title"
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="subtitle">
              Подзаголовок
            </label>
            <input
              id="subtitle"
              className={inputCls}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="industry">
              Отрасль
            </label>
            <input
              id="industry"
              className={inputCls}
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="description">
            Описание
          </label>
          <textarea
            id="description"
            rows={4}
            className={inputCls}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="price">
              Цена, ₸ (тенге)
            </label>
            <input
              id="price"
              type="number"
              min={0}
              className={inputCls}
              value={priceKzt}
              onChange={(e) => setPriceKzt(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="oldPrice">
              Старая цена, ₸ (для зачёркивания)
            </label>
            <input
              id="oldPrice"
              type="number"
              min={0}
              className={inputCls}
              value={oldPriceKzt}
              onChange={(e) => setOldPriceKzt(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        {/* Живой пересчёт в 3 валютах */}
        <div className="rounded-lg bg-foreground/[0.03] p-3 text-sm">
          <p className="mb-1 text-xs uppercase tracking-wide text-foreground/40">
            Цена по курсу НБ РК (RUB/BYN — с округлением)
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 font-medium">
            <span>{preview(priceKzt, "KZT", rates)}</span>
            <span className="text-foreground/60">
              {preview(priceKzt, "RUB", rates)}
            </span>
            <span className="text-foreground/60">
              {preview(priceKzt, "BYN", rates)}
            </span>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <label className={labelCls} htmlFor="status">
              Статус
            </label>
            <select
              id="status"
              className={inputCls}
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as CourseFields["status"])
              }
            >
              <option value="DRAFT">Черновик</option>
              <option value="PUBLISHED">Опубликован</option>
              <option value="ARCHIVED">В архиве</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="duration">
              Доступ
            </label>
            <select
              id="duration"
              className={inputCls}
              value={accessDuration}
              onChange={(e) =>
                setAccessDuration(
                  e.target.value as CourseFields["accessDuration"],
                )
              }
            >
              <option value="LIFETIME">Навсегда</option>
              <option value="MONTHS_1">1 месяц</option>
              <option value="MONTHS_3">3 месяца</option>
              <option value="MONTHS_6">6 месяцев</option>
              <option value="MONTHS_12">12 месяцев</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="sort">
              Порядок сортировки
            </label>
            <input
              id="sort"
              type="number"
              min={0}
              className={inputCls}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="hours">
              Объём (напр. «15 уроков · 5 ч»)
            </label>
            <input
              id="hours"
              className={inputCls}
              value={hoursLabel}
              onChange={(e) => setHoursLabel(e.target.value)}
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground/80">
              <input
                type="checkbox"
                className="size-4 rounded border-foreground/30 accent-amber-500"
                checked={certificateEnabled}
                onChange={(e) => setCertificateEnabled(e.target.checked)}
              />
              Сертификат по окончании
            </label>
          </div>
        </div>

        {/* ─── SEO ─────────────────────────────────────────────── */}
        <div className="border-t border-foreground/10 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground/80">SEO</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAiDraft}
                disabled={aiPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
              >
                {aiPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                AI-черновик
              </button>
              <button
                type="button"
                onClick={handleScore}
                disabled={scorePending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5 disabled:opacity-50"
              >
                {scorePending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Gauge className="size-3.5" />
                )}
                Проверить SEO
              </button>
            </div>
          </div>
          {aiError ? <p className="mt-2 text-xs text-red-600">{aiError}</p> : null}

          {score ? (
            <div className="mt-3 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
              <div className="flex items-center gap-2">
                <span
                  className={`text-lg font-bold ${
                    score.score >= 80
                      ? "text-emerald-600"
                      : score.score >= 50
                        ? "text-amber-600"
                        : "text-red-600"
                  }`}
                >
                  {score.score}/100
                </span>
                <span className="text-xs text-foreground/50">оценка метаданных</span>
              </div>
              {score.issues.length > 0 ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-red-600/90">
                  {score.issues.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : null}
              {score.suggestions.length > 0 ? (
                <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-foreground/60">
                  {score.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="mt-3">
            <SerpPreview
              title={seoTitle || title}
              description={seoDescription || subtitle}
              url={`activesales.by/courses/${course.slug}`}
            />
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="focusKeyword">
            Целевой запрос (focus keyword)
          </label>
          <input
            id="focusKeyword"
            className={inputCls}
            placeholder="например: курсы по продажам астана"
            value={focusKeyword}
            onChange={(e) => setFocusKeyword(e.target.value)}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className={labelCls} htmlFor="seoTitle">
              SEO-заголовок
            </label>
            <CharCounter value={seoTitle} limit={TITLE_LIMIT} />
          </div>
          <input
            id="seoTitle"
            className={inputCls}
            placeholder={title}
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className={labelCls} htmlFor="seoDesc">
              SEO-описание
            </label>
            <CharCounter value={seoDescription} limit={DESC_LIMIT} />
          </div>
          <textarea
            id="seoDesc"
            rows={2}
            className={inputCls}
            placeholder={subtitle}
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="ogTitle">
              OG-заголовок (для соцсетей)
            </label>
            <input
              id="ogTitle"
              className={inputCls}
              placeholder={seoTitle || title}
              value={ogTitle}
              onChange={(e) => setOgTitle(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="ogDesc">
              OG-описание
            </label>
            <input
              id="ogDesc"
              className={inputCls}
              placeholder={seoDescription || subtitle}
              value={ogDescription}
              onChange={(e) => setOgDescription(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="canonical">
            Canonical (override)
          </label>
          <input
            id="canonical"
            className={inputCls}
            placeholder={`/courses/${course.slug}`}
            value={canonicalPath}
            onChange={(e) => setCanonicalPath(e.target.value)}
          />
          <p className="mt-1 text-xs text-foreground/40">
            Оставьте пустым — будет /courses/{course.slug}.
          </p>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground/80">
          <input
            type="checkbox"
            className="size-4 rounded border-foreground/30 accent-amber-500"
            checked={seoNoindex}
            onChange={(e) => setSeoNoindex(e.target.checked)}
          />
          Скрыть из поисковиков (noindex)
        </label>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            Сохранить
          </button>
          {result ? (
            <span
              className={
                result.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"
              }
            >
              {result.text}
            </span>
          ) : null}
        </div>
      </div>

      {/* Правая колонка — обложка */}
      <div className="space-y-4 rounded-2xl border border-foreground/10 bg-background p-5">
        <p className="text-sm font-medium text-foreground/80">Обложка курса</p>
        <div className="relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-slate-700 to-slate-900">
          {coverSrc ? (
            <Image
              key={coverVersion}
              src={coverSrc}
              alt={title}
              fill
              className="object-cover"
              sizes="320px"
              unoptimized
            />
          ) : null}
        </div>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/25 px-4 py-3 text-sm font-medium text-foreground/70 transition-colors hover:border-amber-500 hover:text-amber-700">
          <Upload className="size-4" />
          Загрузить новое фото
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
            className="hidden"
            onChange={handleCover}
          />
        </label>
        <p className="text-xs text-foreground/40">
          PNG, JPEG, WebP, AVIF или GIF. До 8 МБ. Рекомендуемое соотношение 16:9.
        </p>
        {coverMsg ? (
          <p
            className={
              coverMsg.ok
                ? "text-sm text-emerald-700"
                : "text-sm text-red-700"
            }
          >
            {coverMsg.ok ? "✓ " : ""}
            {coverMsg.text}
          </p>
        ) : null}

        <div className="border-t border-foreground/10 pt-3 text-xs text-foreground/40">
          <p className="flex items-center gap-1">
            <AlertCircle className="size-3.5" />
            Модули, уроки и контент управляются фабрикой курсов.
          </p>
        </div>
      </div>
    </div>
  );
}
