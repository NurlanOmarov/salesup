import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { buildSafe } from "@/lib/utils";
import { getStaticPageSeo } from "@/lib/seo/static-pages";
import { siteOrigin } from "@/lib/seo/site";

// Карта строится под хост запроса (мультидомен): на каждом домене свой sitemap
// с его же URL. Из-за headers() маршрут динамический — ответ кэширует nginx.

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await siteOrigin();

  // Оферта/политика — в карте только когда владелец снял noindex в /admin/seo
  // (noindex-страница в sitemap — противоречивый сигнал поисковику).
  const [offerSeo, offerB2bSeo, privacySeo, businessSeo] = await Promise.all([
    getStaticPageSeo("/offer"),
    getStaticPageSeo("/offer-b2b"),
    getStaticPageSeo("/privacy"),
    getStaticPageSeo("/business"),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/courses`, changeFrequency: "weekly", priority: 0.8 },
    // Корпоративный регистр лендинга — самостоятельная посадочная под дорогие
    // B2B-запросы, поэтому в карте с высоким приоритетом.
    ...(businessSeo.noindex
      ? []
      : [{ url: `${base}/business`, changeFrequency: "monthly" as const, priority: 0.8 }]),
    ...(offerSeo.noindex
      ? []
      : [{ url: `${base}/offer`, changeFrequency: "yearly" as const, priority: 0.3 }]),
    ...(offerB2bSeo.noindex
      ? []
      : [{ url: `${base}/offer-b2b`, changeFrequency: "yearly" as const, priority: 0.3 }]),
    ...(privacySeo.noindex
      ? []
      : [{ url: `${base}/privacy`, changeFrequency: "yearly" as const, priority: 0.3 }]),
  ];

  // только опубликованные индексируемые курсы (на сборке без БД — пустой список)
  const courses = await buildSafe(
    () =>
      db.course.findMany({
        where: { status: "PUBLISHED", seoNoindex: false },
        select: { slug: true, updatedAt: true },
      }),
    [] as { slug: string; updatedAt: Date }[],
  );
  const coursePages: MetadataRoute.Sitemap = courses.map((c) => ({
    url: `${base}/courses/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticPages, ...coursePages];
}
