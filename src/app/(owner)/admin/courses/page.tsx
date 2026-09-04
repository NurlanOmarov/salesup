import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { currency } from "@/lib/currency";
import { buildMultiPrice, ratesAvailable } from "@/lib/currency";
import { salePrice } from "@/lib/pricing/promo";
import { coverPublicUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Курсы",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  PUBLISHED: "Опубликован",
  ARCHIVED: "В архиве",
};
const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-foreground/5 text-foreground/60",
  PUBLISHED: "bg-emerald-500/10 text-emerald-700",
  ARCHIVED: "bg-foreground/5 text-foreground/40",
};

export default async function AdminCoursesPage() {
  const [courses, ratesPayload] = await Promise.all([
    db.course.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        industry: true,
        coverUrl: true,
        priceTiyn: true,
        oldPriceTiyn: true,
        status: true,
        inDevelopment: true,
        sortOrder: true,
        hoursLabel: true,
        _count: { select: { enrollments: true } },
      },
    }),
    currency.getRates(),
  ]);
  const rates = ratesPayload.rates;
  const hasRates = ratesAvailable(rates);
  const updatedAt = ratesPayload.updatedAt
    ? new Date(ratesPayload.updatedAt).toLocaleString("ru-RU")
    : "—";

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Курсы</h1>
        <p className="text-xs text-foreground/50">
          Курсы НБ РК обновлены: {updatedAt}
          {!hasRates ? " · курсы загружаются" : ""}
        </p>
      </div>

      <p className="mt-1 text-sm text-foreground/60">
        Управление ценами, обложками и статусом публикации. Цена задаётся в белорусских
        рублях, пересчёт в тенге и рос. рубли — по курсу НБ РК.
      </p>

      <div className="mt-5 overflow-hidden rounded-xl border border-foreground/10 bg-background">
        {courses.length === 0 ? (
          <p className="p-8 text-center text-foreground/50">
            Пока нет курсов.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Курс</th>
                  <th className="px-4 py-3 font-medium">Отрасль</th>
                  <th className="px-4 py-3 font-medium">Цена</th>
                  <th className="px-4 py-3 font-medium">Учеников</th>
                  <th className="px-4 py-3 font-medium">Статус</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => {
                  const prices = buildMultiPrice(c.priceTiyn, rates);
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-foreground/5 last:border-0 hover:bg-foreground/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-foreground/5">
                            {coverPublicUrl(c.coverUrl, c.id) ? (
                              <Image
                                src={coverPublicUrl(c.coverUrl, c.id)!}
                                alt={c.title}
                                fill
                                className="object-cover"
                                sizes="48px"
                                unoptimized
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/admin/courses/${c.id}`}
                              className="block truncate font-medium text-amber-700 hover:underline"
                            >
                              {c.title}
                            </Link>
                            <span className="text-xs text-foreground/40">
                              {c.slug} · порядок {c.sortOrder}
                              {c.hoursLabel ? ` · ${c.hoursLabel}` : ""}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground/70">
                        {c.industry ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {/* В списке — полная цена курса; во время акции рядом
                            показываем, сколько за него платят на витрине. */}
                        <div className="font-medium">{prices.byn}</div>
                        {salePrice(c.priceTiyn).oldTiyn ? (
                          <div className="text-xs font-medium text-brand-strong">
                            акция: {buildMultiPrice(salePrice(c.priceTiyn).tiyn, rates).byn}
                          </div>
                        ) : null}
                        {hasRates ? (
                          <div className="text-xs text-foreground/50">
                            {prices.kzt} · {prices.rub}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-foreground/70">
                        {c._count.enrollments}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              STATUS_STYLES[c.status] ?? ""
                            }`}
                          >
                            {STATUS_LABELS[c.status] ?? c.status}
                          </span>
                          {c.inDevelopment ? (
                            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700">
                              В разработке
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/courses/${c.id}`}
                          className="inline-flex items-center gap-1 text-sm text-amber-700 hover:underline"
                        >
                          <Pencil className="size-3.5" />
                          Изменить
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
