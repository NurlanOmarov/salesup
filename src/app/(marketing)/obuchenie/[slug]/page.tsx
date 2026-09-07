import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link } from "@/components/i18n/link";
import { ArrowRight, ChevronDown, CheckCircle2 } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/landing/reveal";
import { StaticPageBody } from "@/components/landing/static-page-body";
import { getLanding, getPublishedLandings, parseFaq } from "@/lib/seo/landings";
import { pageAlternates, siteOrigin } from "@/lib/seo/site";

// ISR: тексты правятся в админке, страница статична между правками.
export const revalidate = 600;

/**
 * SEO-посадочная под кластер запросов (/obuchenie/<slug>).
 *
 * Отвечает на сам запрос («как отрабатывать возражение „дорого“»), а продажу
 * делает блоком с курсом внизу. Это не копия карточки курса: дублирующий текст
 * не ранжируется, поэтому body пишется отдельно (docs/SEO-LANDINGS.md).
 */
type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const landing = await getLanding(slug);
  if (!landing) return { title: "Страница не найдена", robots: { index: false } };
  return {
    title: landing.title,
    description: landing.description,
    alternates: await pageAlternates(`/obuchenie/${slug}`),
    ...(landing.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function SeoLandingPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const [landing, all, origin] = await Promise.all([
    getLanding(slug),
    getPublishedLandings(),
    siteOrigin(),
  ]);
  if (!landing) notFound();

  const faq = parseFaq(landing.faq);
  // Соседи по кластеру — внутренняя перелинковка: страницы одного намерения
  // поддерживают друг друга и не дают посетителю уйти в поиск заново.
  const siblings = all
    .filter((l) => l.slug !== landing.slug && l.cluster === landing.cluster)
    .slice(0, 4);
  const others = all.filter((l) => l.slug !== landing.slug && l.cluster !== landing.cluster);
  const related = siblings.length > 0 ? siblings : others.slice(0, 4);

  const course = landing.course && landing.course.status === "PUBLISHED" ? landing.course : null;

  const faqJsonLd =
    faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: `${origin}/` },
      { "@type": "ListItem", position: 2, name: "Обучение", item: `${origin}/courses` },
      {
        "@type": "ListItem",
        position: 3,
        name: landing.h1,
        item: `${origin}/obuchenie/${landing.slug}`,
      },
    ],
  };

  return (
    <main>
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

      <section className="border-b border-foreground/8 bg-foreground/[0.015]">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
          <nav aria-label="Хлебные крошки" className="text-sm text-foreground/50">
            <Link href="/" className="hover:text-brand">
              Главная
            </Link>
            <span className="px-1.5">/</span>
            <Link href="/courses" className="hover:text-brand">
              Курсы
            </Link>
          </nav>
          <h1 className="mt-3 text-balance text-3xl font-bold leading-tight sm:text-4xl">
            {landing.h1}
          </h1>
          <p className="mt-4 text-lg text-foreground/70">{landing.intro}</p>
        </div>
      </section>

      <article className="mx-auto max-w-3xl px-4 py-10">
        <StaticPageBody text={landing.body} />
      </article>

      {course ? (
        <section className="mx-auto max-w-3xl px-4 pb-10">
          <Reveal>
            <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-brand">
                Курс по теме
              </p>
              <h2 className="mt-2 text-xl font-bold">{course.title}</h2>
              {course.subtitle ? (
                <p className="mt-1.5 text-foreground/65">{course.subtitle}</p>
              ) : null}
              <ul className="mt-4 space-y-1.5 text-sm text-foreground/70">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-brand" />
                  Видеоуроки, конспекты и скрипты
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-brand" />
                  AI-наставник и тренажёр клиента 24/7
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-brand" />
                  Тесты и именной сертификат
                </li>
              </ul>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  href={`/courses/${course.slug}`}
                  className={cn(buttonVariants({ variant: "brand", size: "lg" }))}
                >
                  Смотреть курс
                  <ArrowRight className="size-4" />
                </Link>
                <span className="text-sm text-foreground/60">
                  {formatPrice(course.priceTiyn)}
                </span>
              </div>
            </div>
          </Reveal>
        </section>
      ) : (
        <section className="mx-auto max-w-3xl px-4 pb-10">
          <Link
            href="/courses"
            className={cn(buttonVariants({ variant: "brand", size: "lg" }))}
          >
            Выбрать курс
            <ArrowRight className="size-4" />
          </Link>
        </section>
      )}

      {faq.length > 0 ? (
        <section className="mx-auto max-w-3xl px-4 pb-12">
          <h2 className="text-2xl font-bold">Частые вопросы</h2>
          <div className="mt-5 space-y-3">
            {faq.map((f) => (
              <details key={f.q} className="group rounded-xl border border-foreground/10">
                <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 font-medium marker:content-none">
                  {f.q}
                  <ChevronDown className="size-4 shrink-0 text-foreground/40 transition-transform group-open:rotate-180" />
                </summary>
                <p className="border-t border-foreground/5 px-5 pb-4 pt-3 text-sm text-foreground/70">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {related.length > 0 ? (
        <section className="mx-auto max-w-3xl px-4 pb-16">
          <h2 className="text-lg font-semibold">Читайте также</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {related.map((l) => (
              <li key={l.slug}>
                <Link
                  href={`/obuchenie/${l.slug}`}
                  className="block h-full rounded-xl border border-foreground/10 p-4 transition-colors hover:border-brand/40"
                >
                  <span className="font-medium">{l.h1}</span>
                  <span className="mt-1 block text-sm text-foreground/60">{l.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
