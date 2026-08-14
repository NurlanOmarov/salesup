import Link from "next/link";
import { Check, Minus, EyeOff, Map as MapIcon, FileCode2 } from "lucide-react";
import { db } from "@/lib/db";
import { env } from "@/env";
import { getStaticPageSeo } from "@/lib/seo/static-pages";

/**
 * Сводка SEO-статуса (server components для /admin/seo): что заполнено у курсов
 * и сколько URL отдаёт sitemap — владелец видит пробелы одним экраном, не открывая
 * каждую карточку. Только чтение БД, без AI.
 */

function Mark({ ok }: { ok: boolean }) {
  return ok ? (
    <Check className="mx-auto size-4 text-emerald-600" />
  ) : (
    <Minus className="mx-auto size-4 text-foreground/25" />
  );
}

/** Таблица заполненности SEO-полей по опубликованным курсам. */
export async function CoursesSeoStatus() {
  const courses = await db.course.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
    select: {
      id: true,
      title: true,
      seoTitle: true,
      seoDescription: true,
      focusKeyword: true,
      coverAlt: true,
      seoNoindex: true,
    },
  });

  if (courses.length === 0) {
    return (
      <p className="mt-3 rounded-2xl border border-dashed border-foreground/15 p-6 text-center text-sm text-foreground/50">
        Опубликованных курсов нет.
      </p>
    );
  }

  return (
    <div className="mt-3 overflow-x-auto rounded-2xl border border-foreground/10">
      <table className="w-full text-sm">
        <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-foreground/50">
          <tr>
            <th className="px-4 py-2 font-medium">Курс</th>
            <th className="px-3 py-2 text-center font-medium">Title</th>
            <th className="px-3 py-2 text-center font-medium">Description</th>
            <th className="px-3 py-2 text-center font-medium">Фокус-ключ (focus keyword)</th>
            <th className="px-3 py-2 text-center font-medium">Alt обложки (alt)</th>
            <th className="px-3 py-2 text-center font-medium">Индекс (index)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-foreground/5">
          {courses.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-2.5">
                <Link
                  href={`/admin/courses/${c.id}`}
                  className="font-medium transition-colors hover:text-amber-700"
                >
                  {c.title}
                </Link>
              </td>
              <td className="px-3 py-2.5"><Mark ok={Boolean(c.seoTitle)} /></td>
              <td className="px-3 py-2.5"><Mark ok={Boolean(c.seoDescription)} /></td>
              <td className="px-3 py-2.5"><Mark ok={Boolean(c.focusKeyword)} /></td>
              <td className="px-3 py-2.5"><Mark ok={Boolean(c.coverAlt)} /></td>
              <td className="px-3 py-2.5 text-center">
                {c.seoNoindex ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] text-foreground/60">
                    <EyeOff className="size-3" />
                    noindex
                  </span>
                ) : (
                  <Check className="mx-auto size-4 text-emerald-600" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-foreground/5 px-4 py-2 text-xs text-foreground/40">
        Пустой Title/Description — не ошибка: работает фолбэк на название и подзаголовок
        курса. Заполняйте там, где хотите переопределить выдачу.
      </p>
    </div>
  );
}

/** Статус sitemap/robots: сколько URL отдаётся и ссылки для проверки. */
export async function SitemapStatus() {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const [publishedIndexable, offerSeo, offerB2bSeo, privacySeo] = await Promise.all([
    db.course.count({ where: { status: "PUBLISHED", seoNoindex: false } }),
    getStaticPageSeo("/offer"),
    getStaticPageSeo("/offer-b2b"),
    getStaticPageSeo("/privacy"),
  ]);
  // Зеркалит src/app/sitemap.ts: / и /courses всегда, юридические страницы — если index.
  const staticCount =
    2 +
    [offerSeo, offerB2bSeo, privacySeo].filter((s) => !s.noindex).length;
  const total = staticCount + publishedIndexable;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-foreground/10 bg-background p-4 text-sm">
      <span className="flex items-center gap-2">
        <MapIcon className="size-4 text-amber-600" />
        В sitemap: <strong>{total}</strong> URL
        <span className="text-xs text-foreground/50">
          ({staticCount} статических + {publishedIndexable} курсов)
        </span>
      </span>
      <a
        href={`${base}/sitemap.xml`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-foreground/60 underline-offset-2 transition-colors hover:text-amber-700 hover:underline"
      >
        sitemap.xml
      </a>
      <a
        href={`${base}/robots.txt`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-foreground/60 underline-offset-2 transition-colors hover:text-amber-700 hover:underline"
      >
        <FileCode2 className="size-3.5" />
        robots.txt
      </a>
    </div>
  );
}
