"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Script from "next/script";

/**
 * Баннер согласия на аналитические cookie + отложенная загрузка счётчиков.
 *
 * По Закону РБ № 99-З обработка данных посетителя аналитическими сервисами
 * (GA4, Яндекс.Метрика — трансграничная передача) требует согласия, поэтому
 * скрипты счётчиков подключаются ТОЛЬКО после нажатия «Принять». Технически
 * необходимые cookie (сессия, тема, CSRF) согласия не требуют и здесь не
 * участвуют. Рекомендации НЦЗПД запрещают «тёмные паттерны», поэтому кнопки
 * принятия и отказа выглядят одинаково.
 *
 * Выбор хранится в localStorage — это не cookie и не персональные данные.
 */

const STORAGE_KEY = "as-cookie-consent";
type Consent = "granted" | "denied";

export function CookieConsent({
  ga4Id,
  yandexMetricaId,
}: {
  ga4Id: string | null;
  yandexMetricaId: string | null;
}) {
  // null — выбор ещё не прочитан (SSR/первый рендер), undefined — выбора нет.
  const [consent, setConsent] = useState<Consent | undefined | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    setConsent(stored === "granted" || stored === "denied" ? stored : undefined);
  }, []);

  function decide(value: Consent) {
    window.localStorage.setItem(STORAGE_KEY, value);
    setConsent(value);
  }

  if (consent === null) return null;

  if (consent === "granted") {
    return (
      <>
        {ga4Id && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');`}
            </Script>
          </>
        )}

        {yandexMetricaId && (
          <Script id="ym-init" strategy="afterInteractive">
            {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');ym(${Number(yandexMetricaId)},'init',{clickmap:true,trackLinks:true,accurateTrackBounce:true});window.__ymCounterId=${Number(yandexMetricaId)};`}
          </Script>
        )}
      </>
    );
  }

  if (consent === "denied") return null;

  return (
    <div
      role="dialog"
      aria-label="Согласие на использование cookie"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-foreground/10 bg-background/95 p-4 backdrop-blur"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground/70">
          Мы используем аналитические cookie, чтобы понимать, какие страницы
          полезны посетителям. Их установка возможна только с вашего согласия —
          подробнее в{" "}
          <Link href="/privacy" className="underline hover:text-brand">
            Политике обработки персональных данных
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => decide("denied")}
            className="rounded-xl border border-foreground/20 px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/5"
          >
            Отклонить
          </button>
          <button
            type="button"
            onClick={() => decide("granted")}
            className="rounded-xl border border-foreground/20 px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/5"
          >
            Принять
          </button>
        </div>
      </div>
    </div>
  );
}
