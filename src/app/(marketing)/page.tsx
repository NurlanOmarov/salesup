import type { Metadata } from "next";
import type { CourseAudience } from "@prisma/client";
import { Link } from "@/components/i18n/link";
import Image from "next/image";
import {
  Award,
  Bot,
  CheckCircle2,
  PlayCircle,
  Podcast,
  Headphones,
  FileText,
  Layers,
  MessageSquareWarning,
  MessagesSquare,
  Mic,
  ListOrdered,
  SearchCheck,
  Flame,
  Trophy,
} from "lucide-react";
import { db } from "@/lib/db";
import { externalRatings, getSeoSettings, getSupportContacts } from "@/lib/seo/settings";
import { buttonVariants } from "@/components/ui/button";
import { entryPackTiyn, quoteSeats } from "@/lib/pricing";
import { cn, buildSafe } from "@/lib/utils";
import { Reveal } from "@/components/landing/reveal";
import { Faq } from "@/components/landing/faq";
import type { ReviewItem } from "@/components/landing/reviews";
import { LeadForm } from "@/components/landing/lead-form";
import { AiDemo } from "@/components/landing/ai-demo";
import { ExternalRatings } from "@/components/landing/external-ratings";
import {
  ExternalReviewsMarquee,
  type ExternalReviewCard,
} from "@/components/landing/external-reviews-marquee";
import { HeroVideo } from "@/components/landing/hero-video";
import { HeroWordStream } from "@/components/landing/hero-word-stream";
import { StatCounter } from "@/components/landing/stat-counter";
import { AnimatedTitle } from "@/components/landing/animated-title";
import { IndustriesMarquee } from "@/components/landing/industries-marquee";
import { VoiceVisualizer } from "@/components/voice-visualizer";
import { landingContent } from "@/content/landing-content";
import { pageAlternates, currentSite } from "@/lib/seo/site";
import { getLocale } from "@/i18n/server";
import { messagesFor } from "@/i18n/messages";
import { currency, formatCurrency, type CurrencyCode } from "@/lib/currency";
import { DEFAULT_SITE } from "@/lib/seo/site-hosts";

// ISR: страница статична, отзывы обновляются раз в 10 минут.
export const revalidate = 600;

// openGraph здесь намеренно не объявляется: объект со страницы заменяет
// родительский целиком, а не дополняет его. Своё объявление без images стирало
// картинку из opengraph-image.tsx, а заодно siteName и locale из layout —
// репост уходил без изображения. og:title и og:description Next соберёт из
// title и description страницы.
export async function generateMetadata(): Promise<Metadata> {
  return {
    alternates: await pageAlternates("/"),
  };
}

const stepIcons = {
  play: PlayCircle,
  bot: Bot,
  check: CheckCircle2,
  award: Award,
} as const;

const formatIcons = {
  play: PlayCircle,
  podcast: Podcast,
  headphones: Headphones,
  file: FileText,
  cards: Layers,
  objections: MessageSquareWarning,
  simulation: MessagesSquare,
  voice: Mic,
  script: ListOrdered,
  audit: SearchCheck,
} as const;

async function getReviews(): Promise<ReviewItem[]> {
  return buildSafe(
    () =>
      db.review.findMany({
        where: { autoModeration: "VALIDATED" },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, userName: true, rating: true, text: true },
      }),
    [],
  );
}

export default async function LandingPage() {
  const reviews = await getReviews();
  // Лучшая цена корпоративного места — для тизера «Для компаний». База та же,
  // что на /business: набор «отраслевой курс + общие», а не библиотека целиком —
  // иначе тизер обещал бы одну цену, а корпоративная страница показывала другую.
  const b2bCourses = await buildSafe(
    () =>
      db.course.findMany({
        where: { status: "PUBLISHED", inDevelopment: false },
        select: { priceTiyn: true, audience: true },
      }),
    [] as { priceTiyn: number; audience: CourseAudience }[],
  );
  const b2bBestPerSeat = quoteSeats(20, entryPackTiyn(b2bCourses)).pricePerSeatTiyn / 100;
  const b2bBestPerMonth = Math.round(b2bBestPerSeat / 12);
  // Контакты — из SeoSettings (правятся в /admin/seo без деплоя).
  const { whatsapp: wa, telegram: tg, viber } = await getSupportContacts();
  // Оценки школы на Яндекс и Google Картах — правятся в /admin/seo.
  const ratings = externalRatings(await getSeoSettings());
  // Цитаты с карт: переносятся владельцем в /admin/reviews (парсинг карт не делаем).
  const externalReviews = await buildSafe(
    () =>
      db.externalReview.findMany({
        where: { published: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        take: 12,
        select: { id: true, author: true, text: true, rating: true, source: true, url: true },
      }),
    [] as ExternalReviewCard[],
  );
  // Своё и внешнее в одной ленте: сначала отзывы учеников платформы.
  const allReviews: ExternalReviewCard[] = [
    ...reviews.map((r) => ({
      id: r.id,
      author: r.userName,
      text: r.text,
      rating: r.rating,
      source: "PLATFORM" as const,
      url: null,
    })),
    ...externalReviews,
  ];
  // Домен захода: гео-строка первого экрана («вся Беларусь» / «весь Казахстан»).
  const site = (await currentSite()) ?? DEFAULT_SITE;
  // Язык страницы: русский по умолчанию, казахский на /kk (i18n/routing.ts).
  const locale = await getLocale();
  const { hero, steps, voiceShowcase, formats, industries, clients, trainer, methodology, stats, aiDemo, faq } =
    landingContent(locale);
  const t = messagesFor(locale);
  // Цена корпоративного места — в валюте страны домена, как и на витрине курсов.
  const { rates } = await currency.getRates();
  const b2bCode = site.currency.toUpperCase() as CurrencyCode;

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero — тёмная «киношная» секция с фоновым синемаграфом (ТЗ §2.3).
          Текст живёт в левой (затенённой) половине кадра, движение — справа. */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        {/* Видео покрывает только зону контента (не полосу счётчиков) — иначе
            кружка, живущая у нижнего края кадра, уезжает под разделитель. */}
        <div className="relative">
          <HeroVideo />
          <HeroWordStream />

          <div className="relative z-[2] mx-auto max-w-6xl px-4 pb-12 pt-16 sm:pb-16 sm:pt-20 lg:pb-24 lg:pt-24">
          <div className="max-w-xl text-center lg:text-left">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-light">
                {t.landing.brandLine}
              </p>
            </Reveal>
            <Reveal delay={0.05}>
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-brand-light/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand-light">
                {hero.badge(site.geo[locale])}
              </span>
            </Reveal>
            <AnimatedTitle
              text={hero.title}
              className="mt-5 text-balance text-4xl font-bold tracking-tight drop-shadow-lg sm:text-5xl xl:text-6xl"
            />
            <Reveal delay={0.1}>
              <p className="mt-5 text-balance text-lg text-white/75">
                {hero.subtitle}
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Link
                  href="/courses"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "brand" }),
                    "w-full sm:w-auto",
                  )}
                >
                  {hero.primaryCta}
                </Link>
                <a
                  href="#zayavka"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "outline-light" }),
                    "w-full sm:w-auto",
                  )}
                >
                  {hero.secondaryCta}
                </a>
              </div>
              <p className="mt-3 text-sm text-white/60">{hero.note}</p>
            </Reveal>
          </div>
          </div>
        </div>

        {/* Счётчики — внутри тёмной секции */}
        <div className="relative border-t border-white/10">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-4">
            {stats.map((s) => (
              <StatCounter key={s.label} {...s} />
            ))}
          </div>
        </div>
      </section>

      {/* Как проходит обучение */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <Reveal>
          <h2 className="text-center text-3xl font-bold">{t.landing.howItWorks}</h2>
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => {
            const Icon = stepIcons[s.icon];
            return (
              <Reveal key={s.title} delay={i * 0.05}>
                <div
                  className={cn(
                    "group relative h-full rounded-2xl border border-foreground/10 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg hover:shadow-brand/5",
                    // линия к следующему шагу — у всех, кроме последнего
                    i < steps.length - 1 && "step-connector",
                  )}
                >
                  <div className="flex size-11 items-center justify-center rounded-xl bg-brand/10 text-brand-strong transition-colors group-hover:bg-brand group-hover:text-white">
                    <Icon className="size-6" />
                  </div>
                  <h3 className="mt-4 font-semibold">
                    <span className="mr-1.5 text-brand-strong">{i + 1}.</span>
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm text-foreground/70">{s.text}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Что внутри каждого урока — форматы обучения */}
      <section>
        <div className="mx-auto max-w-6xl px-4 pb-16 sm:pb-20 sm:pt-4">
          <Reveal>
            <h2 className="text-center text-3xl font-bold">{formats.title}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-foreground/70">
              {formats.subtitle}
            </p>
          </Reveal>
          <div className="spotlight-grid mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {formats.items.map((f, i) => {
              const Icon = formatIcons[f.icon];
              return (
                <Reveal key={f.title} delay={(i % 3) * 0.05}>
                  <div className="spotlight-card group h-full rounded-2xl border border-foreground/10 bg-background p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg hover:shadow-brand/5">
                    <div className="relative flex size-11 items-center justify-center rounded-xl bg-brand/10 text-brand-strong transition-colors group-hover:bg-brand group-hover:text-white">
                      <Icon className="size-6" />
                    </div>
                    <h3 className="relative mt-4 font-semibold">{f.title}</h3>
                    <p className="relative mt-2 text-sm text-foreground/70">
                      {f.text}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>

          {/* Геймификация — сдержанная полоса под форматами */}
          <Reveal delay={0.1}>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 rounded-2xl border border-foreground/10 bg-background p-6 text-center sm:flex-row sm:gap-8 sm:text-left">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                <Flame className="size-5 text-orange-500" />
                {t.landing.streak}
              </p>
              <span className="hidden h-5 w-px bg-foreground/10 sm:block" />
              <p className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                <Trophy className="size-5 text-amber-600" />
                {t.landing.achievements}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Голосовой симулятор — анимация голосовых волн */}
      <section className="border-y border-foreground/5 bg-foreground/[0.025]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:py-20 lg:grid-cols-2">
          <Reveal>
            <div className="relative mx-auto flex aspect-square w-full max-w-sm items-center justify-center overflow-hidden rounded-3xl border border-foreground/10 bg-gradient-to-b from-brand/[0.06] via-[#0a0b11] to-[#07080d] shadow-xl">
              <div className="h-[78%] w-[78%]">
                <VoiceVisualizer demo state="speaking" />
              </div>
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-brand/90 px-2.5 py-1 text-xs font-medium text-white">
                <Mic className="size-3.5" />
                {t.landing.voiceDialog}
              </span>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div>
              <span className="inline-flex items-center rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-strong">
                {voiceShowcase.badge}
              </span>
              <h2 className="mt-3 text-3xl font-bold">{voiceShowcase.title}</h2>
              <p className="mt-3 text-foreground/70">{voiceShowcase.subtitle}</p>
              <ul className="mt-6 space-y-3">
                {voiceShowcase.points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm text-foreground/80">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Отрасли */}
      <section className="border-y border-foreground/5 bg-foreground/[0.025]">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <Reveal>
            <h2 className="text-center text-3xl font-bold">
              {t.landing.industryTitle}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-foreground/70">
              {t.landing.industryText}
            </p>
          </Reveal>
          <Reveal delay={0.05}>
            <div className="mt-8">
              <IndustriesMarquee items={industries} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* О тренере (ТЗ §4.1.1) */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <div className="relative mx-auto w-full max-w-sm">
              {/* фото-cutout тренера на тёмном градиенте */}
              <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950">
                <Image
                  src="/trainer.png"
                  alt={`${trainer.name} — ${trainer.role}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 384px"
                  className="object-contain object-bottom"
                  priority={false}
                />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 backdrop-blur">
                    <p className="text-sm font-semibold text-white">
                      {trainer.name}
                    </p>
                    <p className="text-xs text-white/60">{trainer.role}</p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
          <div>
            <Reveal>
              <span className="text-sm font-semibold uppercase tracking-wider text-brand-strong">
                {trainer.label}
              </span>
              <h2 className="mt-2 text-3xl font-bold">{trainer.name}</h2>
              <p className="mt-1 font-medium text-foreground/60">
                {trainer.role}
              </p>
              <p className="mt-4 text-foreground/70">{trainer.text}</p>
            </Reveal>
            <ul className="mt-6 space-y-3">
              {trainer.bullets.map((b, i) => (
                <li key={b}>
                  <Reveal delay={i * 0.05} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-amber-700" />
                    <span className="text-foreground/80">{b}</span>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Полоса доверия: компании, где обучал тренер (не клиенты платформы) */}
        <Reveal delay={0.1}>
          <div className="mt-14 border-t border-foreground/10 pt-8">
            <p className="text-center text-sm font-medium uppercase tracking-wider text-foreground/40">
              {t.landing.clientsTitle}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {clients.map((c) => (
                <span
                  key={c}
                  className="text-lg font-semibold text-foreground/35 transition-colors hover:text-foreground/70"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Методика + живое демо AI-наставника (ТЗ §4.1.1: интерактивный виджет).
          Демо стоит здесь, а не в hero: секция как раз объясняет, что такое
          AI-наставник, — посетитель может сразу его попробовать. */}
      <section className="border-y border-foreground/5 bg-foreground/[0.025]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-[1fr_1fr] lg:gap-14 lg:py-20">
          <div>
            <Reveal>
              <h2 className="text-3xl font-bold">{methodology.title}</h2>
            </Reveal>
            <div className="mt-8 space-y-5">
              {methodology.points.map((p, i) => (
                <Reveal key={p.title} delay={i * 0.05}>
                  <div className="rounded-2xl border border-foreground/10 bg-background p-6 transition-colors hover:border-brand/40">
                    <h3 className="font-semibold">{p.title}</h3>
                    <p className="mt-2 text-sm text-foreground/70">{p.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delay={0.1}>
            <div>
              <p className="mb-3 text-center text-sm font-medium text-foreground/60 lg:text-left">
                {t.landing.tryNow}
              </p>
              <div className="relative">
                <AiDemo aiDemo={aiDemo} />
                {/* плавающие карточки результата — по краям, не перекрывая контент */}
                <div className="float-y absolute -left-3 -top-4 hidden rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 shadow-xl backdrop-blur sm:block lg:-left-7">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <CheckCircle2 className="size-3.5 text-emerald-400" />
                    {t.landing.objectionHandled}
                  </p>
                </div>
                <div className="float-y-delayed absolute bottom-16 -right-3 hidden rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 shadow-xl backdrop-blur sm:block lg:-right-6">
                  <p className="text-xs font-semibold text-amber-300">
                    {t.landing.dealClosed}
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Отзывы одной лентой: свои (со звёздами) и цитаты с Яндекс и Google Карт.
          Раньше рядом стояли статичная карусель своих отзывов и бегущая лента
          внешних — два блока об одном и том же перегружали страницу. */}
      {allReviews.length > 0 || ratings.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <Reveal>
            <h2 className="text-3xl font-bold">
              <span className="text-brand">{t.landing.reviewsAccent}</span>{" "}
              {t.landing.reviewsTitle}
            </h2>
          </Reveal>

          {ratings.length > 0 ? (
            <Reveal delay={0.05}>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <ExternalRatings items={ratings} words={t.landing.ratingWords} />
              </div>
            </Reveal>
          ) : null}

          <ExternalReviewsMarquee items={allReviews} />
        </section>
      ) : null}

      {/* Тизер корпоративного регистра. Формы здесь нет намеренно: она на
          /business, чтобы корпоративные заявки не смешивались с розничными,
          а страница набирала собственную поисковую выдачу. */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <div className="grid gap-6 rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-brand">
                {t.b2b.badge}
              </p>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                {t.b2b.title}
              </h2>
              <p className="mt-3 max-w-xl text-foreground/70">
                {t.b2b.text}
              </p>
              {/* Порядок суммы прямо в тизере: иначе часть читателей не кликнет,
                  не понимая, их ли это ценовой сегмент. Считает lib/pricing. */}
              <p className="mt-3 text-foreground/80">
                <span className="whitespace-nowrap text-xl font-bold">
                  {t.b2b.priceFrom} {formatCurrency(b2bBestPerSeat * 100, b2bCode, rates)}
                </span>{" "}
                {t.b2b.perSeatYear} {formatCurrency(b2bBestPerMonth * 100, b2bCode, rates)}{" "}
                {t.b2b.perMonth}
              </p>
              <Link
                href="/business"
                className={cn(
                  buttonVariants({ variant: "brand", size: "lg" }),
                  "mt-5 inline-flex",
                )}
              >
                {t.b2b.calculate}
              </Link>
            </div>
            <ul className="grid gap-2.5 text-sm text-foreground/75">
              {[t.b2b.bullet1, t.b2b.bullet2, t.b2b.bullet3].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-emerald-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <Reveal>
          <h2 className="text-center text-3xl font-bold">{t.landing.faqTitle}</h2>
        </Reveal>
        <Reveal delay={0.05}>
          <div className="mt-8">
            <Faq items={faq} />
          </div>
        </Reveal>
      </section>

      {/* Заявка — тёмный блок, закольцовывает страницу с hero */}
      <section id="zayavka" className="mx-auto max-w-6xl px-4 pb-20 pt-4">
        <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-8 text-white md:p-12">
          {/* Фон: размытый вечерний офис. Поверх — плотная затемняющая заливка,
              иначе белый текст на светлых бликах теряет контраст. */}
          <Image
            src="/images/landing/cta-bg.webp"
            alt=""
            aria-hidden
            fill
            sizes="(max-width: 1152px) 100vw, 1152px"
            className="pointer-events-none select-none object-cover opacity-40"
          />
          <div className="pointer-events-none absolute inset-0 bg-slate-950/70" />
          <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-brand/15 blur-3xl" />
          <div className="relative grid items-center gap-10 md:grid-cols-2">
            <Reveal>
              <div>
                <h2 className="text-3xl font-bold">{t.landing.startTitle}</h2>
                <p className="mt-3 text-white/70">
                  {t.landing.startText}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  {wa ? (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({ variant: "outline-light" })}
                    >
                      {t.landing.writeWhatsapp}
                    </a>
                  ) : null}
                  {tg ? (
                    <a
                      href={tg}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({ variant: "outline-light" })}
                    >
                      {t.landing.writeTelegram}
                    </a>
                  ) : null}
                  {/* Viber — белорусская витрина (см. getSupportContacts). */}
                  {viber ? (
                    <a
                      href={viber}
                      className={buttonVariants({ variant: "outline-light" })}
                    >
                      {t.landing.writeViber}
                    </a>
                  ) : null}
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.05}>
              <div className="rounded-2xl bg-background p-6 text-foreground shadow-2xl">
                <LeadForm />
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </main>
  );
}
