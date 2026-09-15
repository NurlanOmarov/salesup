"use client";

import { useRef } from "react";
import { Clapperboard, X } from "lucide-react";
import { LeadForm } from "@/components/landing/lead-form";
import { trackEvent } from "@/lib/analytics/track";
import { useLocale } from "@/i18n/client";
import { messagesFor } from "@/i18n/messages";

/**
 * «Не нашли своей темы?» — последняя плитка сетки каталога: заказ курса под
 * бизнес клиента (заявка с format=CUSTOM).
 *
 * Плитка, а не всплывающее окно по таймеру: каталог — SEO-страница, и навязчивый
 * попап на мобильном Google штрафует, а человек, который ещё листает курсы,
 * закрывает его не читая. Плитка стоит ровно там, где тема «кончилась», — после
 * последней карточки. Модальное окно открывается только по нажатию: форма не
 * уводит со страницы и не теряет выбранный фильтр.
 */
export function CustomCourseOffer() {
  const t = messagesFor(useLocale());
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = () => {
    dialogRef.current?.showModal();
    trackEvent("lead_start", { source: "custom_course" });
  };
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="group flex h-full min-h-72 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand/30 bg-brand/[0.03] p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-brand/60 hover:bg-brand/[0.06]"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
          <Clapperboard className="size-7" />
        </span>
        <span className="mt-4 text-lg font-semibold">{t.catalog.customTitle}</span>
        <span className="mt-2 max-w-xs text-sm text-foreground/65">{t.catalog.customText}</span>
        <span className="mt-5 inline-flex items-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-brand-strong">
          {t.catalog.customCta}
        </span>
      </button>

      {/*
        Нативный <dialog>: фокус-ловушка, Esc и затемнение фона — от браузера.
        Клик по подложке закрывает окно (цель события — сам <dialog>).
      */}
      <dialog
        ref={dialogRef}
        aria-labelledby="custom-course-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-background p-0 text-foreground shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm"
      >
        <div className="max-h-[85dvh] overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 id="custom-course-title" className="text-xl font-bold">
              {t.catalog.customTitle}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={t.catalog.close}
              className="-mr-2 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-md text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
          <p className="mt-2 text-sm text-foreground/70">{t.catalog.customDialogText}</p>
          <LeadForm kind="B2B" format="CUSTOM" className="mt-5" />
        </div>
      </dialog>
    </>
  );
}
