"use client";

import { useEffect, useState } from "react";
import { Link } from "@/components/i18n/link";
import { PlayCircle, CheckCircle2, CreditCard, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics/track";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/landing/reveal";
import { LeadForm } from "@/components/landing/lead-form";
import { useLocale } from "@/i18n/client";
import { messagesFor } from "@/i18n/messages";

/**
 * CTA витринной страницы курса. Три состояния:
 *   • есть активный доступ → «Продолжить обучение»;
 *   • курс связан с товаром магазина и посетитель на белорусском домене →
 *     «Купить» ведёт в магазин activesales.by, где работает эквайринг
 *     Альфа-Банка (docs/WOO-INTEGRATION.md); доступ откроется автоматически;
 *   • иначе → форма заявки, доступ выдаёт админ вручную.
 *
 * Проверка доступа — на клиенте, чтобы страница осталась статической (ISR);
 * запрос дедуплицируется между компонентами.
 */

type AccessPayload = { active: boolean; continueUrl?: string } | null;

const accessCache = new Map<string, Promise<AccessPayload>>();

/**
 * Метка «этот курс уже оплачивали с этого устройства».
 *
 * После оплаты покупатель возвращается со страницы банка без сессии — платформа
 * его не узнаёт и снова предлагает купить. Метка живёт в localStorage и просто
 * подсказывает: доступ уже оплачен, войдите. Ничего не открывает — доступ
 * по-прежнему решает сервер (lib/access.ts), это только подсказка в интерфейсе.
 */
const PAID_KEY = (slug: string) => `salesup.paid.${slug}`;
/** Полгода: за это время человек либо вошёл, либо давно всё выяснил. */
const PAID_TTL_MS = 180 * 24 * 60 * 60 * 1000;

function rememberCheckout(slug: string): void {
  try {
    localStorage.setItem(PAID_KEY(slug), String(Date.now()));
  } catch {
    // приватный режим или запрет на хранилище — подсказки просто не будет
  }
}

function useStartedCheckout(slug: string): boolean {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    try {
      const at = Number(localStorage.getItem(PAID_KEY(slug)));
      setStarted(Boolean(at) && Date.now() - at < PAID_TTL_MS);
    } catch {
      setStarted(false);
    }
  }, [slug]);

  return started;
}

function fetchAccess(slug: string): Promise<AccessPayload> {
  let promise = accessCache.get(slug);
  if (!promise) {
    promise = fetch(`/api/learn/access/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? (r.json() as Promise<AccessPayload>) : null))
      .catch(() => null);
    accessCache.set(slug, promise);
  }
  return promise;
}

/** URL «Продолжить обучение» или null, пока доступа нет / идёт загрузка. */
function useContinueUrl(slug: string): string | null {
  const [continueUrl, setContinueUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAccess(slug).then((data) => {
      if (!cancelled && data?.active) setContinueUrl(data.continueUrl ?? "/app");
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return continueUrl;
}

/** Кнопка в карточке с ценой (hero). */
export function CourseCta({
  slug,
  checkoutUrl,
}: {
  slug: string;
  /** Ссылка на оплату в магазине; null — курс продаётся через заявку. */
  checkoutUrl?: string | null;
}) {
  const continueUrl = useContinueUrl(slug);
  const startedCheckout = useStartedCheckout(slug);
  const t = messagesFor(useLocale());

  if (continueUrl) {
    return (
      <Link
        href={continueUrl}
        onClick={() => trackEvent("continue_course", { slug })}
        className={cn(buttonVariants({ variant: "brand", size: "lg" }), "mt-4 w-full")}
      >
        <PlayCircle className="size-5" />{t.cta.continue}</Link>
    );
  }

  if (checkoutUrl) {
    return (
      <div className="mt-4 space-y-2">
        {startedCheckout ? (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm">
            <p className="font-medium text-amber-300">Вы уже оплачивали этот курс</p>
            <p className="mt-1 text-white/70">
              Доступ открывается сразу после оплаты, логин приходит на указанную почту.
            </p>
            <Link
              href="/login"
              className="mt-2 inline-flex items-center gap-1.5 font-medium text-brand-light underline-offset-4 hover:underline"
            >
              <LogIn className="size-4" />
              Войти в кабинет
            </Link>
          </div>
        ) : null}

        <a
          href={checkoutUrl}
          onClick={() => {
            trackEvent("checkout_start", { slug });
            rememberCheckout(slug);
          }}
          className={cn(buttonVariants({ variant: "brand", size: "lg" }), "w-full")}
        >
          <CreditCard className="size-5" />
          {startedCheckout ? "Оплатить ещё раз" : "Оплатить и начать"}
        </a>

        {/* Постоянная точка входа: покупатель возвращается со страницы банка без
            сессии, и без этой ссылки единственная кнопка на экране — «купить». */}
        <p className="text-center text-sm text-white/60">
          Уже оплатили?{" "}
          <Link href="/login" className="underline underline-offset-4 hover:text-white">
            Войдите в кабинет
          </Link>
        </p>
        <a
          href="#zayavka"
          onClick={() => trackEvent("lead_start", { slug })}
          className="block text-center text-sm text-white/60 underline-offset-4 hover:underline"
        >
          Оплатить по счёту или задать вопрос
        </a>
      </div>
    );
  }

  return (
    <a
      href="#zayavka"
      onClick={() => trackEvent("lead_start", { slug })}
      className={cn(buttonVariants({ variant: "brand", size: "lg" }), "mt-4 w-full")}
    >{t.cta.enroll}</a>
  );
}

/** Нижняя секция #zayavka: форма заявки ↔ «вы уже записаны». */
export function CourseCtaSection({
  slug,
  courseId,
  courseTitle,
  priceByn,
  priceOther,
}: {
  slug: string;
  courseId: string;
  courseTitle: string;
  priceByn: string;
  priceOther: string | null;
}) {
  const continueUrl = useContinueUrl(slug);
  const t = messagesFor(useLocale());

  if (continueUrl) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-8 text-white md:p-12">
        <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-brand/15 blur-3xl" />
        <div className="relative mx-auto max-w-2xl text-center">
          <CheckCircle2 className="mx-auto size-10 text-amber-400" />
          <h2 className="mt-4 text-3xl font-bold">{t.cta.enrolled}</h2>
          <p className="mt-3 text-white/70">{t.cta.accessActive}</p>
          <p className="mt-2 font-semibold text-brand-light">{courseTitle}</p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={continueUrl}
              className={cn(buttonVariants({ variant: "brand", size: "lg" }))}
            >
              <PlayCircle className="size-5" />{t.cta.continue}</Link>
            <Link
              href="/app"
              className={cn(buttonVariants({ variant: "outline-light", size: "lg" }))}
            >{t.cta.myLearning}</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-8 text-white md:p-12">
      <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-brand/15 blur-3xl" />
      <div className="relative grid items-center gap-10 md:grid-cols-2">
        <Reveal>
          <div>
            <h2 className="text-3xl font-bold">{t.cta.enroll}</h2>
            <p className="mt-3 text-white/70">
              {t.cta.leaveRequest}
            </p>
            <p className="mt-2 font-semibold text-brand-light">{courseTitle}</p>
            <p className="text-2xl font-bold">{priceByn}</p>
            {priceOther ? (
              <p className="text-sm text-white/50">{priceOther}</p>
            ) : null}
          </div>
        </Reveal>
        <Reveal delay={0.05}>
          <div className="rounded-2xl bg-background p-6 text-foreground shadow-2xl">
            <LeadForm courseId={courseId} />
          </div>
        </Reveal>
      </div>
    </div>
  );
}
