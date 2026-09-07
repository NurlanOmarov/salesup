import type { Metadata } from "next";
import { MessageSquareQuote } from "lucide-react";
import { db } from "@/lib/db";
import { buildSafe } from "@/lib/utils";
import { ExternalReviewsForm, type ExternalReviewRow } from "./reviews-form";
import { StudentReviews, type StudentReviewRow } from "./student-reviews";

export const metadata: Metadata = {
  title: "Отзывы",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Отзывы с Яндекс и Google Карт, перенесённые вручную.
 *
 * Автосбор не делаем: условия обеих площадок запрещают скрапинг, а вёрстка карт
 * меняется — «фабрика» ломалась бы молча. Владелец копирует текст, автора и
 * ссылку; ссылка обязательна по смыслу — по ней читатель проверяет отзыв на
 * первоисточнике, поэтому «реальные отзывы» на лендинге остаются проверяемым
 * утверждением, а не рекламным.
 */
export default async function AdminReviewsPage() {
  const [rows, studentRows] = await Promise.all([
    buildSafe(
      () => db.externalReview.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }),
      [] as ExternalReviewRow[],
    ),
    buildSafe(
      () =>
        db.review.findMany({
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            userName: true,
            rating: true,
            text: true,
            autoModeration: true,
            moderationNote: true,
            publicConsent: true,
            createdAt: true,
            course: { select: { title: true } },
          },
        }),
      [],
    ),
  ]);

  const students: StudentReviewRow[] = studentRows.map((r) => ({
    id: r.id,
    courseTitle: r.course.title,
    userName: r.userName,
    rating: r.rating,
    text: r.text,
    status: r.autoModeration,
    moderationNote: r.moderationNote,
    publicConsent: r.publicConsent,
    createdAt: r.createdAt.toLocaleDateString("ru-RU"),
  }));

  return (
    <main>
      <h1 className="text-2xl font-bold">Отзывы</h1>
      <section className="mt-6">
        <h2 className="text-lg font-semibold">Отзывы учеников</h2>
        <p className="mt-1 max-w-2xl text-sm text-foreground/60">
          Ученик оставляет отзыв, когда закончил курс и запрашивает сертификат. Хороший
          текст публикуется на странице курса автоматически; сюда попадает спорное —
          короткое, со ссылкой или отклонённое автопроверкой.
        </p>
        <StudentReviews rows={students} />
      </section>

      <h2 className="mt-10 text-lg font-semibold">Отзывы с карт и из соцсетей</h2>
      <p className="mt-1 max-w-2xl text-foreground/60">
        Скопируйте отзыв с карточки организации: текст без правок, имя автора как на
        площадке и ссылку на карточку. Отзывы показываются лентой на главной странице
        рядом с оценками Яндекс и Google Карт. Снятая галочка «Показывать» убирает
        отзыв с сайта, не удаляя его.
      </p>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 text-sm text-foreground/75">
        <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-amber-500" />
        <p>
          Публикуйте отзывы дословно и с указанием автора — так, как они опубликованы
          на площадке. Переписанный или анонимный отзыв нельзя проверить по ссылке, а
          на витрине он заявлен как реальный.
        </p>
      </div>

      <ExternalReviewsForm rows={rows} />
    </main>
  );
}
