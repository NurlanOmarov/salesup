import type { Metadata } from "next";
import { Link } from "@/components/i18n/link";
import { Suspense } from "react";
import { BookOpen } from "lucide-react";
import { db } from "@/lib/db";
import { buttonVariants } from "@/components/ui/button";
import { cn, buildSafe } from "@/lib/utils";
import { currency, buildDisplayPrice, type MainCurrency } from "@/lib/currency";
import { getStaticPageSeo } from "@/lib/seo/static-pages";
import { Reveal } from "@/components/landing/reveal";
import type { CourseCardData } from "@/components/catalog/course-card";
import { CoursesCatalog } from "@/components/catalog/courses-catalog";
import { coursesPageContent } from "@/content/courses-page-content";
import { currentSite, pageAlternates, siteOrigin } from "@/lib/seo/site";
import { getLocale } from "@/i18n/server";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/routing";
import { localizedCard } from "@/lib/courses/i18n";
import { localizedDuration } from "@/lib/courses/duration";
import { localizedIndustry } from "@/content/industries";
import { messagesFor } from "@/i18n/messages";

export const revalidate = 60;

// Метаданные редактируются в /admin/seo (StaticPageSeo); пусто → фолбэки оттуда же.
export async function generateMetadata(): Promise<Metadata> {
  const s = await getStaticPageSeo("/courses");
  return {
    title: s.title,
    description: s.description,
    alternates: await pageAlternates("/courses"),
    robots: { index: !s.noindex },
    // openGraph не объявляется: собственный объект заменяет родительский
    // целиком и без images стирает картинку из opengraph-image.tsx вместе с
    // siteName и locale из layout. og:title и og:description Next возьмёт из
    // полей выше — они и так редактируются в /admin/seo.
  };
}

async function getCourses(main: MainCurrency, locale: Locale): Promise<CourseCardData[]> {
  const [rows, ratesPayload] = await Promise.all([
    buildSafe(
      () =>
        db.course.findMany({
          where: { status: "PUBLISHED" },
          orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
          select: {
            id: true,
            slug: true,
            title: true,
            subtitle: true,
            industry: true,
            audience: true,
            coverUrl: true,
            priceTiyn: true,
            oldPriceTiyn: true,
            hoursLabel: true,
            inDevelopment: true,
            _count: { select: { modules: true } },
            // Перевод карточки на язык витрины (kk/uz); для русского — пусто.
            translations:
              locale === DEFAULT_LOCALE
                ? false
                : {
                    where: { locale },
                    select: {
                      locale: true,
                      title: true,
                      subtitle: true,
                      description: true,
                      seoTitle: true,
                      seoDescription: true,
                    },
                  },
          },
        }),
      [] as Array<Omit<CourseCardData, "prices">>,
    ),
    currency.getRates(),
  ]);
  const rates = ratesPayload.rates;
  return rows.map((r) => {
    const t = localizedCard(r, locale);
    // Акция применяется здесь, а не в запросе: в БД лежит полный прайс.
    return {
      ...r,
      ...t,
      // Отрасль и длительность — тоже витринные подписи, переводим и их.
      industry: localizedIndustry(r.industry, locale),
      hoursLabel: localizedDuration(r.hoursLabel, locale),
      prices: buildDisplayPrice(r.priceTiyn, rates, main, locale),
    };
  });
}

export default async function CoursesPage() {
  // Цены показываем в валюте страны домена (мультидомен), остальные — справочно.
  const site = await currentSite();
  // Тексты каталога — на языке страницы (казахская версия на /kk/courses).
  const locale = await getLocale();
  const { audience, howItWorks, difference, faq } = coursesPageContent(locale);
  const t = messagesFor(locale);
  const courses = await getCourses(site?.currency ?? "byn", locale);

  const siteUrl = await siteOrigin();
  const listJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Курсы по продажам — Бизнес-платформа ACTIVE SALES",
    itemListElement: courses.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.title,
      url: `${siteUrl}/courses/${c.slug}`,
    })),
  };

  // Вопросы страницы отвечают на выбор курса, а не на общие вопросы о платформе
  // (те живут в FAQ главной), поэтому разметка здесь своя.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
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
    ],
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(listJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <Reveal>
        <h1 className="text-3xl font-bold sm:text-4xl">{t.catalogPage.title}</h1>
        <p className="mt-2 max-w-2xl text-foreground/60">
          {t.catalogPage.subtitle}
        </p>
      </Reveal>

      {courses.length === 0 ? (
        <Reveal>
          <div className="mt-20 text-center text-foreground/40">
            <BookOpen className="mx-auto mb-4 size-12 opacity-30" />
            <p className="font-medium">{t.catalogPage.empty}</p>
            <p className="mt-1 text-sm">
              {t.catalogPage.emptyText}
            </p>
          </div>
        </Reveal>
      ) : (
        <Suspense
          fallback={
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" />
          }
        >
          <CoursesCatalog courses={courses} />
        </Suspense>
      )}

      {/* Содержательные блоки — под каталогом: карточки нужны посетителю сразу,
          а текст отвечает тем, кто пришёл из поиска и ещё выбирает. */}
      <section className="mt-20">
        <Reveal>
          <h2 className="text-2xl font-bold sm:text-3xl">{audience.title}</h2>
          <p className="mt-3 max-w-3xl text-foreground/70">{audience.intro}</p>
        </Reveal>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {audience.items.map((item, i) => (
            <Reveal key={item.title} delay={(i % 2) * 0.05}>
              <div className="h-full rounded-2xl border border-foreground/10 p-6">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-foreground/70">{item.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <Reveal>
          <h2 className="text-2xl font-bold sm:text-3xl">{howItWorks.title}</h2>
          <p className="mt-3 max-w-3xl text-foreground/70">{howItWorks.intro}</p>
        </Reveal>
        <ol className="mt-8 space-y-5">
          {howItWorks.steps.map((step, i) => (
            <li key={step.title}>
              <Reveal delay={i * 0.04}>
                <div className="rounded-2xl border border-foreground/10 p-6">
                  <h3 className="font-semibold">
                    <span className="mr-1.5 text-brand-strong">{i + 1}.</span>
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-foreground/70">{step.text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16">
        <Reveal>
          <h2 className="text-2xl font-bold sm:text-3xl">{difference.title}</h2>
        </Reveal>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {difference.items.map((item, i) => (
            <Reveal key={item.title} delay={(i % 2) * 0.05}>
              <div className="h-full rounded-2xl border border-foreground/10 p-6">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-foreground/70">{item.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ на нативном <details>: ответы остаются в HTML и без JavaScript —
          свёрнутый аккордеон на клиенте отдал бы поиску и AI пустую страницу. */}
      <section className="mt-16">
        <Reveal>
          <h2 className="text-2xl font-bold sm:text-3xl">{t.catalogPage.faqTitle}</h2>
        </Reveal>
        <div className="mt-8 divide-y divide-foreground/10 rounded-2xl border border-foreground/10">
          {faq.map((item) => (
            <details key={item.q} className="group px-5 py-4">
              <summary className="cursor-pointer list-none font-medium marker:content-none">
                {item.q}
              </summary>
              <p className="mt-2 text-foreground/70">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <Reveal>
        <div className="mt-16 rounded-2xl border border-foreground/10 p-6 text-center sm:p-8">
          <p className="text-lg font-semibold">{t.catalogPage.helpTitle}</p>
          <p className="mx-auto mt-2 max-w-2xl text-foreground/70">
            {t.catalogPage.helpText}
          </p>
          <Link
            href="/#zayavka"
            className={cn(buttonVariants({ size: "lg", variant: "brand" }), "mt-6")}
          >
            {t.catalogPage.helpCta}
          </Link>
        </div>
      </Reveal>
    </main>
  );
}
