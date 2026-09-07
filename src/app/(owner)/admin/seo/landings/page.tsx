import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { db } from "@/lib/db";
import { buildSafe } from "@/lib/utils";
import { parseFaq } from "@/lib/seo/landings";
import { LandingsForm, type LandingRow, type CourseOption } from "./landings-form";

export const metadata: Metadata = {
  title: "SEO-посадочные",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Страницы под кластеры поисковых запросов (/obuchenie/<slug>).
 *
 * Курсов девять, а запросов сотни: «работа с возражениями», «обучение РОП»,
 * «продажи новостроек» — у каждого своё намерение, и каждому нужна отдельная
 * страница. Дубли не помогают: одна страница = один кластер, свой текст.
 */
export default async function AdminLandingsPage() {
  const [rows, courses] = await Promise.all([
    buildSafe(
      () =>
        db.seoLanding.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
      [],
    ),
    buildSafe(
      () =>
        db.course.findMany({
          where: { status: "PUBLISHED" },
          orderBy: { sortOrder: "asc" },
          select: { id: true, title: true },
        }),
      [] as CourseOption[],
    ),
  ]);

  const landings: LandingRow[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    cluster: r.cluster,
    title: r.title,
    description: r.description,
    h1: r.h1,
    intro: r.intro,
    body: r.body,
    courseId: r.courseId,
    keywords: r.keywords,
    faqText: parseFaq(r.faq)
      .map((f) => `${f.q} :: ${f.a}`)
      .join("\n"),
    published: r.published,
    noindex: r.noindex,
    sortOrder: r.sortOrder,
  }));

  return (
    <main>
      <h1 className="text-2xl font-bold">SEO-посадочные</h1>
      <p className="mt-1 max-w-3xl text-foreground/60">
        Страницы под кластеры запросов: одна страница отвечает на одно намерение и ведёт
        на профильный курс. Не копируйте текст карточки курса — дубль не ранжируется:
        карточка продаёт программу, посадочная отвечает на вопрос человека.
      </p>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 text-sm text-foreground/75">
        <Compass className="mt-0.5 size-4 shrink-0 text-amber-500" />
        <p>
          Держите один кластер = одна страница. «Обучение B2B продажам» и «тренинг B2B
          продаж» — один кластер, а «работа с возражениями в B2B» и «переговоры о цене»
          — уже разные: у них разный вопрос и разный ответ.
        </p>
      </div>

      <LandingsForm rows={landings} courses={courses} />
    </main>
  );
}
