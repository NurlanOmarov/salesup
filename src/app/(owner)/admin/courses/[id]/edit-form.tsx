"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Loader2, Upload, CheckCircle2, AlertCircle, Sparkles, Gauge } from "lucide-react";
import type { RatesMap } from "@/lib/currency";
import { coverPublicUrl } from "@/lib/utils";
import { ACCESS_DURATIONS, ACCESS_DURATION_LABELS } from "@/lib/admin/enrollment";
import { formatDuration, isPriceWithinRange, priceBand } from "@/lib/pricing";
import {
  updateCourseAction,
  uploadCoverAction,
  uploadOgImageAction,
  removeOgImageAction,
  generateCoverAltAction,
} from "../actions";
import {
  generateMetaAction,
  scoreMetaAction,
  keywordMatchAction,
} from "../../seo/actions";
import {
  SerpPreview,
  CharCounter,
  TITLE_LIMIT,
  DESC_LIMIT,
} from "../../seo/serp-preview";
import { AiSuggestionCard, UndoBar } from "../../seo/ai-suggestion";
import type { MetaScore, MetaSuggestion } from "@/lib/seo/ai";

interface CourseFields {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  industry: string | null;
  audience: "EVERYONE" | "SPECIALIZED";
  description: string;
  coverUrl: string | null;
  priceTiyn: number;
  oldPriceTiyn: number | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  inDevelopment: boolean;
  accessDuration: (typeof ACCESS_DURATIONS)[number];
  sortOrder: number;
  hoursLabel: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  canonicalPath: string | null;
  focusKeyword: string | null;
  coverAlt: string | null;
  seoNoindex: boolean;
  certificateEnabled: boolean;
}

const SYMBOLS = { KZT: "₸", RUB: "₽", BYN: "Br" } as const;

// Зеркало округления lib/currency/format (ceil до 100 для KZT/RUB, BYN — база, без округления).
function roundFor(amount: number, code: "KZT" | "RUB" | "BYN"): number {
  if (code === "KZT" || code === "RUB") return Math.ceil(amount / 100) * 100;
  return amount;
}
/** byn — введённая админом цена в BYN; code — валюта отображения (BYN — как есть, KZT/RUB — кросс-курс через rates.BYN). */
function preview(
  byn: number,
  code: "KZT" | "RUB" | "BYN",
  rates: RatesMap,
): string {
  if (code === "BYN") return `${byn.toLocaleString("ru-RU")} ${SYMBOLS.BYN}`;
  const bynRate = rates.BYN;
  if (!bynRate || bynRate <= 0) return "—";
  const kzt = byn * bynRate;
  if (code === "KZT") return `${Math.round(roundFor(kzt, "KZT")).toLocaleString("ru-RU")} ${SYMBOLS.KZT}`;
  const rate = rates[code];
  if (!rate || rate <= 0) return "—";
  const v = roundFor(kzt / rate, code);
  return `${Math.round(v).toLocaleString("ru-RU")} ${SYMBOLS[code]}`;
}

export function CourseEditForm({
  course,
  rates,
  totalSec,
}: {
  course: CourseFields;
  rates: RatesMap;
  /** Суммарная длительность опубликованных уроков — задаёт ступень цены. */
  totalSec: number | null;
}) {
  const [title, setTitle] = useState(course.title);
  const [subtitle, setSubtitle] = useState(course.subtitle ?? "");
  const [industry, setIndustry] = useState(course.industry ?? "");
  const [audience, setAudience] = useState(course.audience);
  const [description, setDescription] = useState(course.description);
  const [priceByn, setPriceByn] = useState(course.priceTiyn / 100);
  // Ступень и коридор пересчитываются при смене класса прямо в форме.
  const band = priceBand(audience, totalSec);
  const [oldPriceByn, setOldPriceByn] = useState(
    course.oldPriceTiyn ? course.oldPriceTiyn / 100 : 0,
  );
  const [status, setStatus] = useState(course.status);
  const [inDevelopment, setInDevelopment] = useState(course.inDevelopment);
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

  const [coverAlt, setCoverAlt] = useState(course.coverAlt ?? "");
  const [ogKey, setOgKey] = useState(course.ogImageUrl);
  const [ogMsg, setOgMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // AI-помощники SEO. UX: AI ничего не перезаписывает молча — предложение показывается
  // карточкой «было → станет» (Применить / Отклонить), после применения — «Вернуть».
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [metaSuggestion, setMetaSuggestion] = useState<MetaSuggestion | null>(null);
  const [metaUndo, setMetaUndo] = useState<{ title: string; description: string } | null>(null);
  const [altPending, setAltPending] = useState(false);
  const [altSuggestion, setAltSuggestion] = useState<string | null>(null);
  const [altUndo, setAltUndo] = useState<string | null>(null);
  const [scorePending, setScorePending] = useState(false);
  const [score, setScore] = useState<MetaScore | null>(null);
  const [keywordFit, setKeywordFit] = useState<number | null>(null);

  async function handleAiDraft() {
    setAiError(null);
    setAiPending(true);
    const res = await generateMetaAction({
      source: `${title}\n${subtitle}\n${description}`.trim(),
      focusKeyword: focusKeyword || undefined,
    });
    setAiPending(false);
    if (res.ok) setMetaSuggestion(res.data);
    else setAiError(res.error);
  }

  function applyMetaSuggestion() {
    if (!metaSuggestion) return;
    setMetaUndo({ title: seoTitle, description: seoDescription });
    setSeoTitle(metaSuggestion.title);
    setSeoDescription(metaSuggestion.description);
    setMetaSuggestion(null);
  }

  function undoMeta() {
    if (!metaUndo) return;
    setSeoTitle(metaUndo.title);
    setSeoDescription(metaUndo.description);
    setMetaUndo(null);
  }

  async function handleScore() {
    setAiError(null);
    setScore(null);
    setKeywordFit(null);
    setScorePending(true);
    const [scoreRes, fitRes] = await Promise.all([
      scoreMetaAction({
        title: seoTitle || title,
        description: seoDescription || subtitle,
        focusKeyword: focusKeyword || undefined,
        source: description || undefined,
      }),
      focusKeyword.trim() && description.trim()
        ? keywordMatchAction({ focusKeyword, source: description })
        : Promise.resolve(null),
    ]);
    setScorePending(false);
    if (scoreRes.ok) setScore(scoreRes.data);
    else setAiError(scoreRes.error);
    if (fitRes?.ok) setKeywordFit(fitRes.data.match);
  }

  async function handleAltAi() {
    setAiError(null);
    setAltPending(true);
    const res = await generateCoverAltAction({ courseId: course.id });
    setAltPending(false);
    if (res.ok) setAltSuggestion(res.data.alt);
    else setAiError(res.error);
  }

  async function handleOgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOgMsg(null);
    const fd = new FormData();
    fd.append("courseId", course.id);
    fd.append("file", file);
    const res = await uploadOgImageAction(fd);
    if (res.ok) {
      setOgKey(res.data.ogImageUrl);
      setOgMsg({ ok: true, text: "OG-картинка обновлена" });
    } else {
      setOgMsg({ ok: false, text: res.error });
    }
    e.target.value = "";
  }

  async function handleOgRemove() {
    setOgMsg(null);
    const res = await removeOgImageAction({ courseId: course.id });
    if (res.ok) {
      setOgKey(null);
      setOgMsg({ ok: true, text: "Вернулись к авто-генерации" });
    } else {
      setOgMsg({ ok: false, text: res.error });
    }
  }

  /** Сброс всех полей формы к последним сохранённым значениям (props). */
  function handleReset() {
    setTitle(course.title);
    setSubtitle(course.subtitle ?? "");
    setIndustry(course.industry ?? "");
    setAudience(course.audience);
    setDescription(course.description);
    setPriceByn(course.priceTiyn / 100);
    setOldPriceByn(course.oldPriceTiyn ? course.oldPriceTiyn / 100 : 0);
    setStatus(course.status);
    setInDevelopment(course.inDevelopment);
    setAccessDuration(course.accessDuration);
    setSortOrder(course.sortOrder);
    setHoursLabel(course.hoursLabel ?? "");
    setSeoTitle(course.seoTitle ?? "");
    setSeoDescription(course.seoDescription ?? "");
    setOgTitle(course.ogTitle ?? "");
    setOgDescription(course.ogDescription ?? "");
    setCanonicalPath(course.canonicalPath ?? "");
    setFocusKeyword(course.focusKeyword ?? "");
    setCoverAlt(course.coverAlt ?? "");
    setSeoNoindex(course.seoNoindex);
    setCertificateEnabled(course.certificateEnabled);
    setMetaSuggestion(null);
    setMetaUndo(null);
    setAltSuggestion(null);
    setAltUndo(null);
    setScore(null);
    setKeywordFit(null);
    setResult(null);
    setAiError(null);
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
        audience,
        description,
        priceByn,
        oldPriceByn,
        status,
        inDevelopment,
        accessDuration,
        sortOrder,
        hoursLabel,
        seoTitle,
        seoDescription,
        ogTitle,
        ogDescription,
        canonicalPath,
        focusKeyword,
        coverAlt,
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
            <label className={labelCls} htmlFor="audience">
              Для кого
            </label>
            <select
              id="audience"
              className={inputCls}
              value={audience}
              onChange={(e) =>
                setAudience(e.target.value as CourseFields["audience"])
              }
            >
              <option value="SPECIALIZED">Под отрасль</option>
              <option value="EVERYONE">Для всех</option>
            </select>
            <p className="mt-1 text-xs text-foreground/45">
              Управляет фильтром на витрине /courses.
            </p>
          </div>
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
            placeholder="Напр. Медпредставители"
          />
          <p className="mt-1 text-xs text-foreground/45">
            Метка отрасли и таблетка-фильтр — только для «Под отрасль».
          </p>
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
              Цена, Br (BYN)
            </label>
            <input
              id="price"
              type="number"
              min={0}
              className={inputCls}
              value={priceByn}
              onChange={(e) => setPriceByn(Number(e.target.value) || 0)}
            />
            {/* Подсказка по сетке docs/PRICING-PLAN.md: цена зависит от класса
                И объёма курса. Не запрет, а напоминание: цену вне коридора легко
                поставить случайно, а заметить потом трудно. */}
            <p className="mt-1 text-xs text-foreground/50">
              {formatDuration(totalSec)} · ступень «{band.tier.label}» ·
              рекомендовано{" "}
              <button
                type="button"
                onClick={() => setPriceByn(band.price / 100)}
                className="underline hover:text-foreground"
              >
                {band.price / 100} Br
              </button>{" "}
              (коридор {band.min / 100}–{band.max / 100} Br)
              {!isPriceWithinRange(audience, Math.round(priceByn * 100), totalSec) ? (
                <span className="ml-1 text-amber-700">— цена вне коридора</span>
              ) : null}
            </p>
          </div>
          <div>
            <label className={labelCls} htmlFor="oldPrice">
              Старая цена, Br (для зачёркивания)
            </label>
            <input
              id="oldPrice"
              type="number"
              min={0}
              className={inputCls}
              value={oldPriceByn}
              onChange={(e) => setOldPriceByn(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        {/* Живой пересчёт в 3 валютах */}
        <div className="rounded-lg bg-foreground/[0.03] p-3 text-sm">
          <p className="mb-1 text-xs uppercase tracking-wide text-foreground/40">
            Цена по курсу НБ РК (KZT/RUB — с округлением)
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 font-medium">
            <span>{preview(priceByn, "BYN", rates)}</span>
            <span className="text-foreground/60">
              {preview(priceByn, "KZT", rates)}
            </span>
            <span className="text-foreground/60">
              {preview(priceByn, "RUB", rates)}
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
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground/80">
              <input
                type="checkbox"
                className="size-4 rounded border-foreground/30 accent-amber-500"
                checked={inDevelopment}
                onChange={(e) => setInDevelopment(e.target.checked)}
              />
              Бейдж «В разработке»
            </label>
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
              {ACCESS_DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {ACCESS_DURATION_LABELS[d]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-foreground/50">
              Столько ученик будет видеть курс, если при выдаче доступа оставить
              «по тарифу курса». Эта же подпись показывается покупателю на странице
              курса.
            </p>
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

          {metaSuggestion ? (
            <div className="mt-3">
              <AiSuggestionCard
                fields={[
                  {
                    label: "SEO-заголовок (title)",
                    current: seoTitle,
                    suggested: metaSuggestion.title,
                    limit: TITLE_LIMIT,
                  },
                  {
                    label: "SEO-описание (description)",
                    current: seoDescription,
                    suggested: metaSuggestion.description,
                    limit: DESC_LIMIT,
                  },
                ]}
                onApply={applyMetaSuggestion}
                onDismiss={() => setMetaSuggestion(null)}
              />
            </div>
          ) : null}
          {metaUndo && !metaSuggestion ? (
            <div className="mt-2">
              <UndoBar onUndo={undoMeta} />
            </div>
          ) : null}

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
                {keywordFit != null ? (
                  <span
                    className={`ml-auto text-xs font-medium ${
                      keywordFit >= 0.55
                        ? "text-emerald-600"
                        : keywordFit >= 0.4
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                    title="Семантическое соответствие фокус-ключа содержанию курса (embeddings)"
                  >
                    ключ ↔ контент: {Math.round(keywordFit * 100)}%
                  </span>
                ) : null}
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
            placeholder="например: курсы по продажам минск"
            value={focusKeyword}
            onChange={(e) => setFocusKeyword(e.target.value)}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className={labelCls} htmlFor="seoTitle">
              SEO-заголовок (title)
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
              SEO-описание (description)
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
              OG-заголовок (og:title, для соцсетей)
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
              OG-описание (og:description)
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
          <button
            type="button"
            onClick={handleReset}
            disabled={pending}
            className="rounded-lg border border-foreground/15 px-4 py-2.5 text-sm font-medium text-foreground/60 transition-colors hover:bg-foreground/5 disabled:opacity-60"
          >
            Отменить изменения
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

        {/* Alt-текст обложки (image SEO/доступность): автозаполнение из названия+отрасли */}
        <div className="border-t border-foreground/10 pt-3">
          <div className="flex items-center justify-between">
            <label
              className="text-sm font-medium text-foreground/80"
              htmlFor="coverAlt"
            >
              Alt-текст обложки (alt)
            </label>
            <button
              type="button"
              onClick={handleAltAi}
              disabled={altPending || !coverSrc}
              className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/5 px-2 py-1 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
            >
              {altPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Sparkles className="size-3" />
              )}
              Заполнить из названия
            </button>
          </div>
          <input
            id="coverAlt"
            className={inputCls}
            placeholder={title}
            value={coverAlt}
            onChange={(e) => setCoverAlt(e.target.value)}
          />
          {altSuggestion ? (
            <div className="mt-2">
              <AiSuggestionCard
                fields={[{ label: "Alt-текст", current: coverAlt, suggested: altSuggestion }]}
                onApply={() => {
                  setAltUndo(coverAlt);
                  setCoverAlt(altSuggestion);
                  setAltSuggestion(null);
                }}
                onDismiss={() => setAltSuggestion(null)}
              />
            </div>
          ) : null}
          {altUndo != null && !altSuggestion ? (
            <div className="mt-1.5">
              <UndoBar
                onUndo={() => {
                  setCoverAlt(altUndo);
                  setAltUndo(null);
                }}
              />
            </div>
          ) : null}
          <p className="mt-1 text-xs text-foreground/40">
            Пусто → используется название курса. Сохраняется кнопкой «Сохранить».
          </p>
        </div>

        {/* OG-картинка (превью ссылки в соцсетях/мессенджерах) */}
        <div className="border-t border-foreground/10 pt-3">
          <p className="text-sm font-medium text-foreground/80">
            OG-картинка (соцсети)
          </p>
          <p className="mt-1 text-xs text-foreground/40">
            {ogKey
              ? "Загружена своя картинка — она показывается при шаринге ссылки."
              : "Не задана — превью генерируется автоматически из названия и цены."}
          </p>
          {ogKey ? (
            <div className="relative mt-2 aspect-[1200/630] overflow-hidden rounded-lg border border-foreground/10">
              {/* превью через api-роут с cache-bust по ключу */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/og-image/${course.id}?v=${encodeURIComponent(ogKey)}`}
                alt="OG-превью курса"
                className="size-full object-cover"
              />
            </div>
          ) : null}
          <div className="mt-2 flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-foreground/25 px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:border-amber-500 hover:text-amber-700">
              <Upload className="size-3.5" />
              {ogKey ? "Заменить" : "Загрузить (1200×630)"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleOgUpload}
              />
            </label>
            {ogKey ? (
              <button
                type="button"
                onClick={handleOgRemove}
                className="rounded-lg px-2 py-1.5 text-xs text-foreground/50 transition-colors hover:bg-red-500/10 hover:text-red-600"
              >
                Убрать
              </button>
            ) : null}
          </div>
          {ogMsg ? (
            <p
              className={
                ogMsg.ok ? "mt-1.5 text-xs text-emerald-700" : "mt-1.5 text-xs text-red-700"
              }
            >
              {ogMsg.text}
            </p>
          ) : null}
        </div>

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
