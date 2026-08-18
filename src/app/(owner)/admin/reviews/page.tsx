import type { Metadata } from "next";
import { MessageSquareQuote } from "lucide-react";
import { db } from "@/lib/db";
import { buildSafe } from "@/lib/utils";
import { ExternalReviewsForm, type ExternalReviewRow } from "./reviews-form";

export const metadata: Metadata = {
  title: "Отзывы с карт",
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
  const rows = await buildSafe(
    () => db.externalReview.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }),
    [] as ExternalReviewRow[],
  );

  return (
    <main>
      <h1 className="text-2xl font-bold">Отзывы с карт</h1>
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
