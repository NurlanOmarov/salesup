import type { Metadata } from "next";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { buildSafe } from "@/lib/utils";
import { getStaticPageSeo } from "@/lib/seo/static-pages";
import { MIN_B2B_SEATS, quoteSeats, SUBSCRIPTION_YEAR_TIYN } from "@/lib/pricing";
import { AudienceSwitch } from "@/components/landing/audience-switch";
import { Reveal } from "@/components/landing/reveal";
import { Faq } from "@/components/landing/faq";
import { BusinessCta } from "./business-cta";
import { currentSite, pageAlternates } from "@/lib/seo/site";
import { getLocale } from "@/i18n/server";
import { businessContent } from "@/content/business-content";
import { currency, formatCurrency, type CurrencyCode } from "@/lib/currency";

export const revalidate = 300;

/**
 * Корпоративный регистр лендинга (docs/PRICING-PLAN.md §8, B2B-PLAN §8).
 *
 * Отдельный URL, а не состояние на главной: у корпоративных запросов своя
 * (более дорогая) выдача, на страницу можно лить рекламу и давать ссылку в КП.
 * Переключатель «Себе | Команде» связывает её с главной в обе стороны.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [s, c] = await Promise.all([
    getStaticPageSeo("/business"),
    getLocale().then(businessContent),
  ]);
  return {
    title: s.title,
    description: s.description,
    alternates: await pageAlternates("/business"),
    robots: { index: !s.noindex, follow: true },
    // Ссылку на эту страницу отправляют в мессенджере и почтой, поэтому картинка
    // репоста своя: дефолтная — про розничные курсы, а тут разговор с компанией.
    openGraph: {
      type: "website",
      url: "/business",
      title: s.title,
      description: s.description,
      images: [
        {
          url: "/images/landing/og-business.webp",
          width: 1200,
          height: 675,
          alt: c.hero.heroAlt,
        },
      ],
    },
  };
}

export default async function BusinessPage() {
  // На сборке БД недоступна — buildSafe отдаёт запасное значение вместо падения
  // пререндера (тот же приём, что в sitemap).
  // Курсы для калькулятора: цена места считается либо по всей библиотеке, либо
  // по выбранным курсам — компании часто нужен один отраслевой, и цена подписки
  // отпугнула бы её втрое большей суммой.
  const courses = await buildSafe(
    () =>
      db.course.findMany({
        where: { status: "PUBLISHED", inDevelopment: false },
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true, priceTiyn: true },
      }),
    [] as { id: string; title: string; priceTiyn: number }[],
  );
  const coursesCount = courses.length;

  // Язык страницы и валюта страны домена: казахская версия — в тенге,
  // российская — в рублях, белорусская — в BYN (мультидомен, D-013).
  const locale = await getLocale();
  const c = businessContent(locale);
  const site = await currentSite();
  const code = (site?.currency ?? "byn").toUpperCase() as CurrencyCode;
  const { rates } = await currency.getRates();
  const money = (byn: number) => formatCurrency(byn * 100, code, rates);

  // Крайние точки сетки: лучшая цена места (максимальный объём) и цена на входе.
  const bestPerSeat = quoteSeats(20, SUBSCRIPTION_YEAR_TIYN).pricePerSeatTiyn / 100;
  const entryPerSeat =
    quoteSeats(MIN_B2B_SEATS, SUBSCRIPTION_YEAR_TIYN).pricePerSeatTiyn / 100;
  const bestPerMonth = Math.round(bestPerSeat / 12);

  return (
    <main>
      {/* ── Первый экран ───────────────────────────────────────────── */}
      {/* Тёмный кадр, как hero на главной: корпоративная страница должна читаться
          продолжением бренда, а не отдельным документом. Текст живёт в левой,
          пустой части кадра; калькулятор ложится светлой карточкой справа. */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <Image
          src="/images/landing/business-hero.webp"
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="pointer-events-none select-none object-cover object-right"
        />
        {/* Слева заливка плотнее: под заголовком кадр почти чёрный, справа —
            видно команду. Без градиента белый текст спорил бы с окнами. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/75 to-slate-950/25" />

        <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-12 sm:pt-16 lg:pb-16">
        <AudienceSwitch current="b2b" size="hero" onDark />

        {/* [&>*]:min-w-0 — иначе колонка не сжимается ниже своего min-content
            и на телефоне страница получает горизонтальный скролл. */}
        <div className="mt-6 grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-start [&>*]:min-w-0">
          <div>
            <h1 className="text-balance text-3xl font-bold leading-tight drop-shadow-lg sm:text-4xl lg:text-5xl">
              {c.hero.title}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/75">
              {c.hero.subtitle}
            </p>

            {/* Цена в первом экране: человек, который сканирует страницу за пять
                секунд, должен понять свой ли это ценовой сегмент, не долистывая
                до калькулятора. Цифры считает lib/pricing — расхождение с
                калькулятором и счётом невозможно. */}
            <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="whitespace-nowrap text-2xl font-bold sm:text-3xl">
                {c.hero.priceFrom} {money(bestPerSeat)}
              </p>
              <p className="text-white/75">
                {c.hero.perSeatYear} {money(bestPerMonth)} {c.hero.perMonth}
              </p>
            </div>
            <p className="mt-1 text-sm text-white/60">
              {c.hero.entryNote(MIN_B2B_SEATS, money(entryPerSeat))}
            </p>

            <ul className="mt-6 space-y-2.5">
              {[
                coursesCount > 0
                  ? c.hero.coursesWithCount(coursesCount)
                  : c.hero.coursesFallback,
                c.hero.bulletCabinet,
                c.hero.bulletTrainers,
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-white/85">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <Reveal>
            <BusinessCta
              subscriptionYearTiyn={SUBSCRIPTION_YEAR_TIYN}
              courses={courses}
              currencyCode={code}
              rates={rates}
            />
          </Reveal>
        </div>
        </div>
      </section>

      {/* ── Выгоды ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold sm:text-3xl">{c.benefitsTitle}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {c.benefits.map((b, i) => (
            <Reveal key={b.title} delay={i * 0.05}>
              <div className="h-full rounded-2xl border border-foreground/10 bg-background p-5">
                <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <b.icon className="size-5" />
                </div>
                <h3 className="mt-3 font-semibold">{b.title}</h3>
                <p className="mt-1.5 text-sm text-foreground/65">{b.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Как это работает ───────────────────────────────────────── */}
      <section className="border-y border-foreground/8 bg-foreground/[0.015]">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold sm:text-3xl">{c.howTitle}</h2>

          <Reveal>
            <div className="relative mt-6 aspect-[16/7] overflow-hidden rounded-2xl border border-foreground/10">
              <Image
                src="/images/landing/business-how.webp"
                alt={c.hero.howAlt}
                fill
                sizes="(max-width: 1024px) 100vw, 1152px"
                className="object-cover"
              />
            </div>
          </Reveal>

          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {c.steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.05}>
                <li className="relative rounded-2xl border border-foreground/10 bg-background p-5">
                  <span className="text-sm font-bold text-brand">0{i + 1}</span>
                  <h3 className="mt-1.5 font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-foreground/65">{s.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-2xl font-bold sm:text-3xl">{c.faqTitle}</h2>
        <div className="mt-6">
          <Faq items={c.faq} />
        </div>
      </section>

      {/* ── Повтор заявки ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.015] p-6 sm:p-8">
          <h2 className="text-2xl font-bold">{c.quoteTitle}</h2>
          <p className="mt-2 max-w-2xl text-foreground/65">
            {c.quoteText}
          </p>
          <div className="mt-6">
            <BusinessCta
              subscriptionYearTiyn={SUBSCRIPTION_YEAR_TIYN}
              courses={courses}
              currencyCode={code}
              rates={rates}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
