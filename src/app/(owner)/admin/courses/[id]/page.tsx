import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { currency } from "@/lib/currency";
import { buildMultiPrice, ratesAvailable } from "@/lib/currency";
import { CourseEditForm } from "./edit-form";

export const metadata: Metadata = {
  title: "Редактирование курса",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function CourseEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [course, ratesPayload] = await Promise.all([
    db.course.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        industry: true,
        audience: true,
        description: true,
        coverUrl: true,
        priceTiyn: true,
        oldPriceTiyn: true,
        status: true,
        inDevelopment: true,
        accessDuration: true,
        sortOrder: true,
        hoursLabel: true,
        seoTitle: true,
        seoDescription: true,
        ogTitle: true,
        ogDescription: true,
        ogImageUrl: true,
        canonicalPath: true,
        focusKeyword: true,
        coverAlt: true,
        seoNoindex: true,
        certificateEnabled: true,
        modules: { select: { id: true, title: true, _count: { select: { lessons: true } } } },
      },
    }),
    currency.getRates(),
  ]);
  if (!course) notFound();

  const rates = ratesPayload.rates;
  const prices = buildMultiPrice(course.priceTiyn, rates);
  const hasRates = ratesAvailable(rates);

  return (
    <main>
      <Link
        href="/admin/courses"
        className="inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        К реестру курсов
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{course.title}</h1>
          <p className="mt-0.5 text-sm text-foreground/50">
            slug: {course.slug} · {course.modules.length} модулей
          </p>
        </div>
        <div className="rounded-xl border border-foreground/10 bg-background p-3 text-right text-sm">
          <p className="text-xs uppercase tracking-wide text-foreground/40">
            Текущая цена (по курсу НБ РК)
          </p>
          <p className="mt-1 font-bold">{prices.byn}</p>
          {hasRates ? (
            <p className="text-xs text-foreground/50">
              {prices.kzt} · {prices.rub}
            </p>
          ) : null}
        </div>
      </div>

      <CourseEditForm course={course} rates={rates} />
    </main>
  );
}
