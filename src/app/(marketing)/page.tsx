import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Award, Bot, CheckCircle2, PlayCircle } from "lucide-react";
import { db } from "@/lib/db";
import { env } from "@/env";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/landing/reveal";
import { Faq } from "@/components/landing/faq";
import { Reviews, type ReviewItem } from "@/components/landing/reviews";
import { LeadForm } from "@/components/landing/lead-form";
import { AiDemo } from "@/components/landing/ai-demo";
import { StatCounter } from "@/components/landing/stat-counter";
import { AnimatedTitle } from "@/components/landing/animated-title";
import { IndustriesMarquee } from "@/components/landing/industries-marquee";
import {
  clients,
  faq,
  hero,
  industries,
  methodology,
  stats,
  steps,
  trainer,
} from "@/content/landing";

// ISR: страница статична, отзывы обновляются раз в 10 минут.
export const revalidate = 600;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    title: "SalesAcademy — курсы по продажам с AI-наставником",
    description: hero.subtitle,
    type: "website",
  },
};

const stepIcons = {
  play: PlayCircle,
  bot: Bot,
  check: CheckCircle2,
  award: Award,
} as const;

async function getReviews(): Promise<ReviewItem[]> {
  const rows = await db.review.findMany({
    where: { autoModeration: "VALIDATED" },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, userName: true, rating: true, text: true },
  });
  return rows;
}

export default async function LandingPage() {
  const reviews = await getReviews();
  const wa = env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
  const tg = env.NEXT_PUBLIC_SUPPORT_TELEGRAM;

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

      {/* Hero — тёмная «киношная» секция (ТЗ §2.3, ориентир MasterClass) */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="aurora-a absolute -top-32 left-1/2 h-96 w-[60rem] -translate-x-1/2 rounded-full bg-amber-500/15 blur-3xl" />
          <div className="aurora-b absolute -bottom-48 right-0 h-96 w-96 rounded-full bg-indigo-500/15 blur-3xl" />
          {/* тонкая сетка для глубины */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-16 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:pb-24">
          <div className="text-center lg:text-left">
            <Reveal>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
                {hero.badge}
              </span>
            </Reveal>
            <AnimatedTitle
              text={hero.title}
              className="mt-5 text-balance text-4xl font-bold tracking-tight sm:text-5xl xl:text-6xl"
            />
            <Reveal delay={0.1}>
              <p className="mx-auto mt-5 max-w-xl text-balance text-lg text-white/70 lg:mx-0">
                {hero.subtitle}
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start sm:justify-center">
                <Link
                  href="/courses"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "accent" }),
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
              <p className="mt-3 text-sm text-white/50">{hero.note}</p>
            </Reveal>
          </div>

          {/* Демо AI-наставника (ТЗ §4.1.1: интерактивный виджет на лендинге) */}
          <Reveal delay={0.2}>
            <div className="relative">
              <AiDemo />
              {/* плавающие карточки результата */}
              <div className="float-y absolute -left-3 -top-4 hidden rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 shadow-xl backdrop-blur sm:block lg:-left-8">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                  Возражение отработано
                </p>
              </div>
              <div className="float-y-delayed absolute -bottom-4 -right-2 hidden rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 shadow-xl backdrop-blur sm:block lg:-right-6">
                <p className="text-xs font-semibold text-amber-300">
                  +1 закрытая сделка 🎉
                </p>
              </div>
            </div>
          </Reveal>
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
          <h2 className="text-center text-3xl font-bold">Как проходит обучение</h2>
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => {
            const Icon = stepIcons[s.icon];
            return (
              <Reveal key={s.title} delay={i * 0.05}>
                <div className="group h-full rounded-2xl border border-foreground/10 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 transition-colors group-hover:bg-amber-500 group-hover:text-slate-950">
                    <Icon className="size-6" />
                  </div>
                  <h3 className="mt-4 font-semibold">
                    <span className="mr-1.5 text-amber-700">{i + 1}.</span>
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm text-foreground/70">{s.text}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Отрасли */}
      <section className="border-y border-foreground/5 bg-foreground/[0.025]">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <Reveal>
            <h2 className="text-center text-3xl font-bold">
              Продажи в вашей отрасли
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-foreground/70">
              AI-задачи и кейсы подстраиваются под сферу, в которой вы работаете.
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
              <span className="text-sm font-semibold uppercase tracking-wider text-amber-700">
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

        {/* Полоса клиентов (реальные клиенты ACTIVE SALES) */}
        <Reveal delay={0.1}>
          <div className="mt-14 border-t border-foreground/10 pt-8">
            <p className="text-center text-sm font-medium uppercase tracking-wider text-foreground/40">
              Среди клиентов агентства
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

      {/* Методика */}
      <section className="border-y border-foreground/5 bg-foreground/[0.025]">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <Reveal>
            <h2 className="text-center text-3xl font-bold">{methodology.title}</h2>
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {methodology.points.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.05}>
                <div className="h-full rounded-2xl border border-foreground/10 bg-background p-6 transition-colors hover:border-amber-500/40">
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="mt-2 text-sm text-foreground/70">{p.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Отзывы */}
      {reviews.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <Reveal>
            <h2 className="text-3xl font-bold">Отзывы учеников</h2>
          </Reveal>
          <Reveal delay={0.05}>
            <div className="mt-8">
              <Reviews items={reviews} />
            </div>
          </Reveal>
        </section>
      ) : null}

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <Reveal>
          <h2 className="text-center text-3xl font-bold">Частые вопросы</h2>
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
          <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="relative grid items-center gap-10 md:grid-cols-2">
            <Reveal>
              <div>
                <h2 className="text-3xl font-bold">Начните обучение</h2>
                <p className="mt-3 text-white/70">
                  Оставьте заявку — расскажем о курсах, подберём программу под вашу
                  отрасль и подскажем удобный способ оплаты. Онлайн-оплата не
                  требуется.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  {wa ? (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({ variant: "outline-light" })}
                    >
                      Написать в WhatsApp
                    </a>
                  ) : null}
                  {tg ? (
                    <a
                      href={tg}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({ variant: "outline-light" })}
                    >
                      Написать в Telegram
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
