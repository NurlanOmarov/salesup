"use client";

import { useState, useTransition } from "react";
import { Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { updateSeoSettingsAction, generateMetaAction } from "./actions";
import {
  SerpPreview,
  CharCounter,
  TITLE_LIMIT,
  DESC_LIMIT,
} from "./serp-preview";

export interface SeoSettingsFields {
  titleTemplate: string;
  defaultTitle: string;
  defaultDescription: string;
  socialInstagram: string | null;
  socialTelegram: string | null;
  socialYoutube: string | null;
  socialTiktok: string | null;
  googleVerification: string | null;
  yandexVerification: string | null;
  ga4Id: string | null;
  yandexMetricaId: string | null;
}

const inputCls =
  "mt-1 block w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20";
const labelCls = "block text-sm font-medium text-foreground/80";

export function SeoSettingsForm({
  settings,
  siteUrl,
}: {
  settings: SeoSettingsFields;
  siteUrl: string;
}) {
  const [titleTemplate, setTitleTemplate] = useState(settings.titleTemplate);
  const [defaultTitle, setDefaultTitle] = useState(settings.defaultTitle);
  const [defaultDescription, setDefaultDescription] = useState(
    settings.defaultDescription,
  );
  const [socialInstagram, setSocialInstagram] = useState(
    settings.socialInstagram ?? "",
  );
  const [socialTelegram, setSocialTelegram] = useState(
    settings.socialTelegram ?? "",
  );
  const [socialYoutube, setSocialYoutube] = useState(
    settings.socialYoutube ?? "",
  );
  const [socialTiktok, setSocialTiktok] = useState(settings.socialTiktok ?? "");
  const [googleVerification, setGoogleVerification] = useState(
    settings.googleVerification ?? "",
  );
  const [yandexVerification, setYandexVerification] = useState(
    settings.yandexVerification ?? "",
  );
  const [ga4Id, setGa4Id] = useState(settings.ga4Id ?? "");
  const [yandexMetricaId, setYandexMetricaId] = useState(
    settings.yandexMetricaId ?? "",
  );

  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  function handleSave() {
    setResult(null);
    startTransition(async () => {
      const res = await updateSeoSettingsAction({
        titleTemplate,
        defaultTitle,
        defaultDescription,
        socialInstagram,
        socialTelegram,
        socialYoutube,
        socialTiktok,
        googleVerification,
        yandexVerification,
        ga4Id,
        yandexMetricaId,
      });
      setResult(
        res.ok ? { ok: true, text: "Сохранено" } : { ok: false, text: res.error },
      );
    });
  }

  async function handleAi() {
    setAiError(null);
    setAiPending(true);
    const res = await generateMetaAction({
      source: `${defaultTitle}\n${defaultDescription}`.trim(),
    });
    setAiPending(false);
    if (res.ok) {
      setDefaultTitle(res.data.title);
      setDefaultDescription(res.data.description);
    } else {
      setAiError(res.error);
    }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Левая колонка — поля */}
      <div className="space-y-6">
        {/* Метаданные */}
        <section className="space-y-4 rounded-2xl border border-foreground/10 bg-background p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Метаданные по умолчанию</h2>
            <button
              type="button"
              onClick={handleAi}
              disabled={aiPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/10 disabled:opacity-50 dark:text-amber-400"
            >
              {aiPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              AI-черновик
            </button>
          </div>
          {aiError && (
            <p className="text-xs text-red-600">{aiError}</p>
          )}

          <div>
            <label className={labelCls} htmlFor="titleTemplate">
              Шаблон title
            </label>
            <input
              id="titleTemplate"
              className={inputCls}
              value={titleTemplate}
              onChange={(e) => setTitleTemplate(e.target.value)}
            />
            <p className="mt-1 text-xs text-foreground/50">
              %s — заголовок страницы. Пример: «Курс СПИН %s · ACTIVE SALES».
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className={labelCls} htmlFor="defaultTitle">
                Заголовок главной / по умолчанию
              </label>
              <CharCounter value={defaultTitle} limit={TITLE_LIMIT} />
            </div>
            <input
              id="defaultTitle"
              className={inputCls}
              value={defaultTitle}
              onChange={(e) => setDefaultTitle(e.target.value)}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className={labelCls} htmlFor="defaultDescription">
                Описание по умолчанию
              </label>
              <CharCounter value={defaultDescription} limit={DESC_LIMIT} />
            </div>
            <textarea
              id="defaultDescription"
              rows={3}
              className={inputCls}
              value={defaultDescription}
              onChange={(e) => setDefaultDescription(e.target.value)}
            />
          </div>
        </section>

        {/* Соцпрофили */}
        <section className="space-y-4 rounded-2xl border border-foreground/10 bg-background p-5">
          <div>
            <h2 className="font-semibold">Соцпрофили</h2>
            <p className="mt-1 text-xs text-foreground/50">
              Ссылки на профили → sameAs в разметке организации (брендовая выдача,
              Knowledge Panel).
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="ig">
                Instagram
              </label>
              <input
                id="ig"
                className={inputCls}
                placeholder="https://instagram.com/…"
                value={socialInstagram}
                onChange={(e) => setSocialInstagram(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="tg">
                Telegram
              </label>
              <input
                id="tg"
                className={inputCls}
                placeholder="https://t.me/…"
                value={socialTelegram}
                onChange={(e) => setSocialTelegram(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="yt">
                YouTube
              </label>
              <input
                id="yt"
                className={inputCls}
                placeholder="https://youtube.com/@…"
                value={socialYoutube}
                onChange={(e) => setSocialYoutube(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="tt">
                TikTok
              </label>
              <input
                id="tt"
                className={inputCls}
                placeholder="https://tiktok.com/@…"
                value={socialTiktok}
                onChange={(e) => setSocialTiktok(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Подтверждение прав */}
        <section className="space-y-4 rounded-2xl border border-foreground/10 bg-background p-5">
          <div>
            <h2 className="font-semibold">Подтверждение прав</h2>
            <p className="mt-1 text-xs text-foreground/50">
              Значение content= мета-тега из Search Console / Яндекс.Вебмастера
              (только сам код, без {"<meta>"}).
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="gsc">
                Google Search Console
              </label>
              <input
                id="gsc"
                className={inputCls}
                placeholder="google-site-verification код"
                value={googleVerification}
                onChange={(e) => setGoogleVerification(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="yw">
                Яндекс.Вебмастер
              </label>
              <input
                id="yw"
                className={inputCls}
                placeholder="yandex-verification код"
                value={yandexVerification}
                onChange={(e) => setYandexVerification(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Счётчики */}
        <section className="space-y-4 rounded-2xl border border-foreground/10 bg-background p-5">
          <div>
            <h2 className="font-semibold">Маркетинговые счётчики</h2>
            <p className="mt-1 text-xs text-foreground/50">
              Вставляются только на публичных страницах (лендинг, каталог), не в
              кабинете ученика. Источник продуктовых метрик — своя таблица Event.
              Пусто → счётчик выключен.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="ga4">
                Google Analytics 4 (ID)
              </label>
              <input
                id="ga4"
                className={inputCls}
                placeholder="G-XXXXXXXXXX"
                value={ga4Id}
                onChange={(e) => setGa4Id(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="ym">
                Яндекс.Метрика (ID)
              </label>
              <input
                id="ym"
                className={inputCls}
                placeholder="12345678"
                value={yandexMetricaId}
                onChange={(e) => setYandexMetricaId(e.target.value)}
              />
            </div>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Сохранить
          </button>
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

      {/* Правая колонка — превью, липкая */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <SerpPreview
          title={defaultTitle}
          description={defaultDescription}
          url={siteUrl}
        />
      </div>
    </div>
  );
}
