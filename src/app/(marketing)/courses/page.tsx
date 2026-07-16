import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { db } from "@/lib/db";
import { buildSafe } from "@/lib/utils";
import { currency, buildMultiPrice } from "@/lib/currency";
import { getStaticPageSeo } from "@/lib/seo/static-pages";
import { Reveal } from "@/components/landing/reveal";
import { CourseCard, type CourseCardData } from "@/components/catalog/course-card";

export const revalidate = 60;

// Метаданные редактируются в /admin/seo (StaticPageSeo); пусто → фолбэки оттуда же.
export async function generateMetadata(): Promise<Metadata> {
  const s = await getStaticPageSeo("/courses");
  return {
    title: s.title,
    description: s.description,
    alternates: { canonical: "/courses" },
    robots: { index: !s.noindex },
    openGraph: {
      title: "Каталог курсов по продажам — Бизнес-платформа ACTIVE SALES",
      description: s.description,
      type: "website",
    },
  };
}

async function getCourses(): Promise<CourseCardData[]> {
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
            coverUrl: true,
            priceTiyn: true,
            oldPriceTiyn: true,
            hoursLabel: true,
            _count: { select: { modules: true } },
          },
        }),
      [] as Array<Omit<CourseCardData, "prices">>,
    ),
    currency.getRates(),
  ]);
  const rates = ratesPayload.rates;
  return rows.map((r) => ({ ...r, prices: buildMultiPrice(r.priceTiyn, rates) }));
}

export default async function CoursesPage() {
  const courses = await getCourses();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
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

      <Reveal>
        <h1 className="text-3xl font-bold sm:text-4xl">Каталог курсов</h1>
        <p className="mt-2 max-w-2xl text-foreground/60">
          Практические программы Виталия Дубовика — бизнес-тренера с 20-летним опытом.
          В каждом курсе: видеоуроки, тесты и AI-наставник 24/7.
        </p>
      </Reveal>

      {courses.length === 0 ? (
        <Reveal>
          <div className="mt-20 text-center text-foreground/40">
            <BookOpen className="mx-auto mb-4 size-12 opacity-30" />
            <p className="font-medium">Курсы скоро появятся</p>
            <p className="mt-1 text-sm">
              Оставьте заявку на главной странице — уведомим вас о старте.
            </p>
          </div>
        </Reveal>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c, i) => (
            <Reveal key={c.slug} delay={i * 0.04}>
              <CourseCard course={c} />
            </Reveal>
          ))}
        </div>
      )}
    </main>
  );
}
