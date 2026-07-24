import Script from "next/script";
import { getSeoSettings } from "@/lib/seo/settings";

/**
 * Маркетинговые счётчики (GA4 / Яндекс.Метрика) — ТОЛЬКО на публичных (marketing)
 * страницах (CLAUDE.md D-002: источник истины — своя Event; внешние счётчики — лишь
 * маркетинговый слой). В кабинет ученика НЕ подключать (правило 9, ПДн). Id пусты →
 * ничего не рендерится. Значения задаются в админке «SEO-настройки».
 */
export async function MarketingAnalytics() {
  const { ga4Id, yandexMetricaId } = await getSeoSettings();
  if (!ga4Id && !yandexMetricaId) return null;

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
        <>
          <Script id="ym-init" strategy="afterInteractive">
            {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');ym(${Number(yandexMetricaId)},'init',{clickmap:true,trackLinks:true,accurateTrackBounce:true});window.__ymCounterId=${Number(yandexMetricaId)};`}
          </Script>
          <noscript>
            <div>
              {/* Трекинг-пиксель Метрики: обычный img (next/image неприменим). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://mc.yandex.ru/watch/${yandexMetricaId}`}
                style={{ position: "absolute", left: "-9999px" }}
                alt=""
              />
            </div>
          </noscript>
        </>
      )}
    </>
  );
}
