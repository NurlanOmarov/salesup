import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  Users,
  Award,
  PlayCircle,
  Lock,
  ChevronDown,
} from "lucide-react";
import { db } from "@/lib/db";
import { env } from "@/env";
import { formatPrice, buildSafe, coverPublicUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { currency, buildMultiPrice, ratesAvailable } from "@/lib/currency";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/landing/reveal";
import { CourseCta, CourseCtaSection } from "@/components/landing/course-cta";
import { Reviews, type ReviewItem } from "@/components/landing/reviews";
import { trainer } from "@/content/landing";
import { resolveRedirect } from "@/lib/seo/redirects";
import { getRelatedCards } from "@/lib/seo/related";
import { getSupportContacts } from "@/lib/seo/settings";

export const revalidate = 60;

type Params = { slug: string };

async function getCourse(slug: string) {
  return db.course.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      modules: {
        orderBy: { sortOrder: "asc" },
        include: {
          lessons: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              title: true,
              isFreePreview: true,
              videoStatus: true,
            },
          },
        },
      },
      reviews: {
        where: { autoModeration: "VALIDATED" },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, userName: true, rating: true, text: true },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) return {};

  return {
    title: course.seoTitle ?? course.title,
    description: course.seoDescription ?? course.subtitle ?? undefined,
    alternates: { canonical: course.canonicalPath || `/courses/${slug}` },
    robots: course.seoNoindex ? { index: false, follow: true } : undefined,
    openGraph: {
      title: course.ogTitle ?? course.seoTitle ?? course.title,
      description:
        course.ogDescription ?? course.seoDescription ?? course.subtitle ?? undefined,
      type: "website",
    },
  };
}

export async function generateStaticParams() {
  return buildSafe(async () => {
    const courses = await db.course.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true },
    });
    return courses.map((c) => ({ slug: c.slug }));
  }, [] as { slug: string }[]);
}

export default async function CoursePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) {
    // Курс не найден — возможно, slug переименован фабрикой: пробуем 308-редирект.
    const to = await resolveRedirect(`/courses/${slug}`);
    if (to) permanentRedirect(to);
    notFound();
  }

  // Агрегат рейтинга по всем прошедшим модерацию отзывам (для звёзд в выдаче)
  const [ratingAgg, related] = await Promise.all([
    db.review.aggregate({
      where: { courseId: course.id, autoModeration: "VALIDATED" },
      _avg: { rating: true },
      _count: true,
    }),
    getRelatedCards(course.id),
  ]);

  const ratesPayload = await currency.getRates();
  const prices = buildMultiPrice(course.priceTiyn, ratesPayload.rates);
  const hasRates = ratesAvailable(ratesPayload.rates);

  // Контакты — из SeoSettings (правятся в /admin/seo без деплоя).
  const { whatsapp: wa, telegram: tg } = await getSupportContacts();
  const reviews = course.reviews as ReviewItem[];

  const learnPoints = Array.isArray(course.learnPoints)
    ? (course.learnPoints as string[])
    : [];
  const targetAudience = Array.isArray(course.targetAudience)
    ? (course.targetAudience as string[])
    : [];
  const faqItems = Array.isArray(course.faq)
    ? (course.faq as { q: string; a: string }[])
    : [];

  const totalLessons = course.modules.reduce((n, m) => n + m.lessons.length, 0);

  // JSON-LD
  const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "";
  const courseJsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.subtitle ?? course.description,
    url: `${siteUrl}/courses/${slug}`,
    provider: {
      "@type": "Organization",
      name: "Бизнес-платформа ACTIVE SALES",
      url: siteUrl,
    },
    instructor: {
      "@type": "Person",
      name: trainer.name,
      jobTitle: trainer.role,
    },
    offers: {
      "@type": "Offer",
      price: Math.round(course.priceTiyn / 100),
      priceCurrency: "BYN",
      availability: "https://schema.org/InStock",
    },
    ...(course.hoursLabel ? { timeRequired: course.hoursLabel } : {}),
    ...(ratingAgg._count > 0 && ratingAgg._avg.rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(ratingAgg._avg.rating.toFixed(1)),
            reviewCount: ratingAgg._count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(reviews.length > 0
      ? {
          review: reviews.map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.userName },
            reviewRating: {
              "@type": "Rating",
              ratingValue: r.rating,
              bestRating: 5,
              worstRating: 1,
            },
            reviewBody: r.text,
          })),
        }
      : {}),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: siteUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "Курсы",
        item: `${siteUrl}/courses`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: course.title,
        item: `${siteUrl}/courses/${slug}`,
      },
    ],
  };

  const faqJsonLd =
    faqItems.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqItems.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      ) : null}

      {/* Hero */}
      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_380px]">
            <div>
              {course.industry ? (
                <Reveal>
                  <span className="inline-flex items-center rounded-full border border-brand-light/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand-light">
                    {course.industry}
                  </span>
                </Reveal>
              ) : null}
              <Reveal delay={0.05}>
                <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl xl:text-5xl">
                  {course.title}
                </h1>
              </Reveal>
              {course.subtitle ? (
                <Reveal delay={0.08}>
                  <p className="mt-3 text-lg text-white/70">{course.subtitle}</p>
                </Reveal>
              ) : null}

              {/* Мета-строка */}
              <Reveal delay={0.1}>
                <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-white/50">
                  {course.hoursLabel ? (
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-4" />
                      {course.hoursLabel}
                    </span>
                  ) : null}
                  <span className="flex items-center gap-1.5">
                    <PlayCircle className="size-4" />
                    {totalLessons} уроков
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Award className="size-4" />
                    Сертификат
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="size-4" />
                    Пожизненный доступ
                  </span>
                </div>
              </Reveal>

              {/* Что вы получите */}
              {learnPoints.length > 0 ? (
                <Reveal delay={0.12}>
                  <div className="mt-8">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-light">
                      Что вы получите
                    </h2>
                    <ul className="mt-3 space-y-2">
                      {learnPoints.map((p) => (
                        <li key={p} className="flex items-start gap-2.5">
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-amber-400" />
                          <span className="text-white/80">{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              ) : null}
            </div>

            {/* Sticky price card */}
            <Reveal delay={0.15}>
              <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 lg:sticky lg:top-24">
                {coverPublicUrl(course.coverUrl, course.id) ? (
                  <div className="relative mb-4 aspect-video overflow-hidden rounded-xl">
                    <Image
                      src={coverPublicUrl(course.coverUrl, course.id)!}
                      alt={course.coverAlt ?? course.title}
                      fill
                      className="object-cover"
                      sizes="380px"
                    />
                  </div>
                ) : null}

                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-white">
                    {prices.byn}
                  </span>
                  {course.oldPriceTiyn ? (
                    <span className="text-lg text-white/40 line-through">
                      {formatPrice(course.oldPriceTiyn)}
                    </span>
                  ) : null}
                </div>
                {hasRates ? (
                  <p className="mt-1 text-sm text-white/50">
                    ≈ {prices.kzt} · ≈ {prices.rub}
                  </p>
                ) : null}
                <p className="mt-1 text-sm text-white/50">
                  Онлайн-оплата не требуется
                </p>

                <CourseCta slug={slug} />

                <div className="mt-4 flex flex-col gap-2">
                  {wa ? (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        buttonVariants({ variant: "outline-light", size: "sm" }),
                        "w-full",
                      )}
                    >
                      Написать в WhatsApp
                    </a>
                  ) : null}
                  {tg ? (
                    <a
                      href={tg}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        buttonVariants({ variant: "outline-light", size: "sm" }),
                        "w-full",
                      )}
                    >
                      Написать в Telegram
                    </a>
                  ) : null}
                </div>

                <ul className="mt-5 space-y-1.5 border-t border-white/10 pt-4 text-sm text-white/60">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-amber-400" />
                    Пожизненный доступ
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-amber-400" />
                    AI-наставник 24/7
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-amber-400" />
                    Сертификат по окончании
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-amber-400" />
                    Субтитры на 4 языках
                  </li>
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Программа курса */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <Reveal>
          <h2 className="text-2xl font-bold">Программа курса</h2>
          <p className="mt-1 text-foreground/60">
            {course.modules.length} модулей · {totalLessons} уроков
          </p>
        </Reveal>

        <div className="mt-6 space-y-3">
          {course.modules.map((module, mIdx) => (
            <Reveal key={module.id} delay={mIdx * 0.04}>
              <details className="group rounded-xl border border-foreground/10 bg-background">
                <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 marker:content-none">
                  <div className="flex items-center gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand-strong">
                      {mIdx + 1}
                    </span>
                    <span className="font-semibold">{module.title}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-foreground/40">
                    <span>{module.lessons.length} уроков</span>
                    <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                  </div>
                </summary>
                <ul className="border-t border-foreground/5 px-5 py-3">
                  {module.lessons.map((lesson, lIdx) => (
                    <li
                      key={lesson.id}
                      className="flex items-center gap-3 py-2.5 text-sm"
                    >
                      <span className="text-foreground/30">{lIdx + 1}.</span>
                      {lesson.isFreePreview ? (
                        <PlayCircle className="size-4 shrink-0 text-amber-600" />
                      ) : (
                        <Lock className="size-4 shrink-0 text-foreground/20" />
                      )}
                      <span className="flex-1 text-foreground/80">{lesson.title}</span>
                      {lesson.isFreePreview ? (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Бесплатно
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Для кого курс */}
      {targetAudience.length > 0 ? (
        <section className="border-y border-foreground/5 bg-foreground/[0.025]">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <Reveal>
              <h2 className="text-2xl font-bold">Для кого этот курс</h2>
            </Reveal>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {targetAudience.map((a, i) => (
                <Reveal key={a} delay={i * 0.04}>
                  <div className="flex items-start gap-3 rounded-xl border border-foreground/10 bg-background p-4">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-amber-700" />
                    <span>{a}</span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Описание */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-10 lg:grid-cols-2">
          <Reveal>
            <h2 className="text-2xl font-bold">О курсе</h2>
            <p className="mt-4 leading-relaxed text-foreground/70">{course.description}</p>
          </Reveal>

          {/* Тренер — краткий блок */}
          <Reveal delay={0.05}>
            <div className="rounded-2xl border border-foreground/10 bg-background p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-strong">
                Ваш тренер
              </p>
              <p className="mt-2 text-lg font-bold">{trainer.name}</p>
              <p className="text-sm text-foreground/60">{trainer.role}</p>
              <p className="mt-3 text-sm text-foreground/70">{trainer.text}</p>
              <Link
                href="/#trainer"
                className="mt-4 inline-block text-sm font-medium text-brand-strong hover:text-brand"
              >
                Подробнее о тренере →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Отзывы */}
      {reviews.length > 0 ? (
        <section className="border-y border-foreground/5 bg-foreground/[0.025]">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <Reveal>
              <h2 className="text-2xl font-bold">Отзывы</h2>
            </Reveal>
            <Reveal delay={0.05}>
              <div className="mt-8">
                <Reviews items={reviews} />
              </div>
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* FAQ */}
      {faqItems.length > 0 ? (
        <section className="mx-auto max-w-3xl px-4 py-14">
          <Reveal>
            <h2 className="text-center text-2xl font-bold">Частые вопросы</h2>
          </Reveal>
          <div className="mt-6 space-y-3">
            {faqItems.map((f, i) => (
              <Reveal key={f.q} delay={i * 0.04}>
                <details className="group rounded-xl border border-foreground/10">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 font-medium marker:content-none">
                    {f.q}
                    <ChevronDown className="size-4 shrink-0 text-foreground/40 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="border-t border-foreground/5 px-5 pb-4 pt-3 text-sm text-foreground/70">
                    {f.a}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {/* CTA — форма заявки (или «вы уже записаны» для студента с доступом) */}
      <section id="zayavka" className="mx-auto max-w-6xl px-4 pb-20 pt-4">
        <CourseCtaSection
          slug={slug}
          courseId={course.id}
          courseTitle={course.title}
          priceByn={prices.byn}
          priceOther={hasRates ? `≈ ${prices.kzt} · ≈ ${prices.rub}` : null}
        />
      </section>

      {/* Связанные курсы — семантическая перелинковка (embeddings, кэш сутки) */}
      {related.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-bold">Связанные курсы</h2>
          <p className="mt-1 text-foreground/60">
            Программы по смежным темам — усильте навыки продаж.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => {
              const cover = coverPublicUrl(r.coverUrl, r.id);
              return (
                <Link
                  key={r.id}
                  href={`/courses/${r.slug}`}
                  className="group overflow-hidden rounded-2xl border border-foreground/10 bg-background transition-shadow hover:shadow-lg"
                >
                  <div className="relative aspect-video bg-gradient-to-br from-slate-700 to-slate-900">
                    {cover ? (
                      <Image
                        src={cover}
                        alt={r.coverAlt ?? r.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        sizes="(max-width: 640px) 100vw, 380px"
                      />
                    ) : null}
                    {r.industry ? (
                      <span className="absolute left-3 top-3 rounded-full bg-slate-950/70 px-2.5 py-1 text-xs font-medium text-white">
                        {r.industry}
                      </span>
                    ) : null}
                  </div>
                  <div className="p-4">
                    <p className="font-semibold leading-snug group-hover:text-brand-strong">
                      {r.title}
                    </p>
                    {r.subtitle ? (
                      <p className="mt-1 line-clamp-2 text-sm text-foreground/60">
                        {r.subtitle}
                      </p>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}
