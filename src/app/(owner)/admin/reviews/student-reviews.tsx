"use client";

import { useTransition } from "react";
import { Star, Eye, EyeOff, Trash2, Loader2 } from "lucide-react";
import { setStudentReviewStatusAction, deleteStudentReviewAction } from "./actions";

export interface StudentReviewRow {
  id: string;
  courseTitle: string;
  userName: string;
  rating: number;
  text: string;
  status: "PENDING" | "VALIDATED" | "FAILED";
  moderationNote: string | null;
  publicConsent: boolean;
  createdAt: string;
}

const STATUS_LABEL: Record<StudentReviewRow["status"], string> = {
  VALIDATED: "На витрине",
  PENDING: "Скрыт — на проверке",
  FAILED: "Отклонён автоматически",
};

const STATUS_CLS: Record<StudentReviewRow["status"], string> = {
  VALIDATED: "bg-emerald-500/10 text-emerald-600",
  PENDING: "bg-amber-500/10 text-amber-600",
  FAILED: "bg-red-500/10 text-red-600",
};

/**
 * Отзывы учеников: их пишут после прохождения курса, перед запросом сертификата.
 * Автомодерация уже решила, что показывать; здесь владелец правит решение —
 * публикует спорный отзыв или убирает лишний.
 */
export function StudentReviews({ rows }: { rows: StudentReviewRow[] }) {
  const [pending, start] = useTransition();

  if (rows.length === 0) {
    return (
      <p className="mt-4 rounded-xl border border-foreground/10 p-4 text-sm text-foreground/60">
        Отзывов учеников пока нет. Они появляются, когда ученик заканчивает курс и
        запрашивает сертификат.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="rounded-xl border border-foreground/10 bg-background p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{r.courseTitle}</p>
              <p className="text-xs text-foreground/60">
                {r.userName} · {r.createdAt}
                {r.publicConsent ? "" : " · без согласия на публикацию"}
              </p>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLS[r.status]}`}
            >
              {STATUS_LABEL[r.status]}
            </span>
          </div>

          <div className="mt-2 flex gap-0.5" aria-label={`Оценка ${r.rating} из 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                aria-hidden
                className={
                  n <= r.rating ? "size-3.5 fill-amber-400 text-amber-400" : "size-3.5 text-foreground/20"
                }
              />
            ))}
          </div>

          <p className="mt-2 whitespace-pre-line text-sm text-foreground/80">{r.text}</p>
          {r.moderationNote ? (
            <p className="mt-1 text-xs text-amber-600">Автопроверка: {r.moderationNote}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {r.status === "VALIDATED" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await setStudentReviewStatusAction({ id: r.id, status: "FAILED" });
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-medium hover:bg-foreground/5"
              >
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : <EyeOff className="size-3.5" />}
                Убрать с витрины
              </button>
            ) : (
              <button
                type="button"
                disabled={pending || !r.publicConsent}
                title={r.publicConsent ? undefined : "Ученик не давал согласия на публикацию"}
                onClick={() =>
                  start(async () => {
                    await setStudentReviewStatusAction({ id: r.id, status: "VALIDATED" });
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-medium hover:bg-foreground/5 disabled:opacity-40"
              >
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
                Опубликовать
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await deleteStudentReviewAction({ id: r.id });
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-600/25 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-600/5"
            >
              <Trash2 className="size-3.5" />
              Удалить
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
