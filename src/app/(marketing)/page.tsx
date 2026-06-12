import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { env } from "@/env";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/landing/reveal";
import { Faq } from "@/components/landing/faq";
import { Reviews, type ReviewItem } from "@/components/landing/reviews";
import { LeadForm } from "@/components/landing/lead-form";
import {
  faq,
  hero,
  industries,
  methodology,
  stats,
  steps,
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
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,theme(colors.indigo.500/15),transparent)]" />
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:py-28">
          <Reveal>
            <span className="inline-block rounded-full border border-foreground/15 px-3 py-1 text-xs font-medium text-foreground/70">
              {hero.badge}
            </span>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="mt-5 text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              {hero.title}
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-foreground/70">
              {hero.subtitle}
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/courses"
                className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
              >
                {hero.primaryCta}
              </Link>
              <a
                href="#zayavka"
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "w-full sm:w-auto",
                )}
              >
                {hero.secondaryCta}
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Как проходит обучение */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <h2 className="text-center text-3xl font-bold">Как проходит обучение</h2>
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.05}>
              <div className="h-full rounded-2xl border border-foreground/10 p-6">
                <div className="flex size-9 items-center justify-center rounded-full bg-foreground text-background">
                  {i + 1}
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-foreground/70">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Отрасли */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <h2 className="text-center text-3xl font-bold">
            Продажи в вашей отрасли
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-foreground/70">
            AI-задачи и кейсы подстраиваются под сферу, в которой вы работаете.
          </p>
        </Reveal>
        <Reveal delay={0.05}>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {industries.map((name) => (
              <span
                key={name}
                className="rounded-full border border-foreground/15 px-4 py-2 text-sm font-medium"
              >
                {name}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Методика */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <h2 className="text-center text-3xl font-bold">{methodology.title}</h2>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {methodology.points.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.05}>
              <div className="h-full rounded-2xl border border-foreground/10 p-6">
                <h3 className="font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-foreground/70">{p.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Счётчики */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid grid-cols-2 gap-6 rounded-3xl border border-foreground/10 p-8 sm:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.05}>
              <div className="text-center">
                <div className="text-3xl font-bold sm:text-4xl">{s.value}</div>
                <div className="mt-1 text-sm text-foreground/60">{s.label}</div>
              </div>
            </Reveal>
          ))}
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

      {/* Заявка */}
      <section id="zayavka" className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid items-center gap-10 rounded-3xl border border-foreground/10 p-8 md:grid-cols-2 md:p-12">
          <Reveal>
            <div>
              <h2 className="text-3xl font-bold">Начните обучение</h2>
              <p className="mt-3 text-foreground/70">
                Оставьте заявку — расскажем о курсах, ответим на вопросы и подскажем
                удобный способ оплаты. Онлайн-оплата не требуется.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Написать в WhatsApp
                  </a>
                ) : null}
                {tg ? (
                  <a
                    href={tg}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Написать в Telegram
                  </a>
                ) : null}
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <LeadForm />
          </Reveal>
        </div>
      </section>
    </main>
  );
}
