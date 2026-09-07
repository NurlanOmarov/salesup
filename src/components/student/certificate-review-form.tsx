"use client";

import { useState, useTransition } from "react";
import { Star, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { submitCourseReviewAction } from "@/app/(student)/app/certificates/actions";
import { Button } from "@/components/ui/button";

/**
 * Отзыв о курсе — шаг перед запросом сертификата.
 *
 * Обязательный, но мягкий: ученик пишет пару предложений и ставит оценку, а
 * публикацию под своим именем подтверждает галочкой (Закон РБ № 99-З — согласие
 * должно быть осознанным действием, а не мелким шрифтом). Снял галочку — отзыв
 * уйдёт владельцу, но на страницу курса не попадёт.
 *
 * У работников организаций имени нет вовсе: платформа не получает их ПДн
 * (CLAUDE.md, правило 9), подпись отзыва обезличена.
 */
export function CertificateReviewForm({
  courseId,
  courseTitle,
  isOrgLearner,
}: {
  courseId: string;
  courseTitle: string;
  isOrgLearner: boolean;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    setError(null);
    if (!rating) {
      setError("Поставьте оценку курсу");
      return;
    }
    start(async () => {
      const res = await submitCourseReviewAction({
        courseId,
        rating,
        text,
        publicConsent: consent,
        ...(isOrgLearner ? {} : { userName: name }),
      });
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <div className="mt-4 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
      <p className="text-sm font-semibold">Шаг 1. Отзыв о курсе</p>
      <p className="mt-1 text-sm text-foreground/60">
        Расскажите, что изменилось в вашей работе после «{courseTitle}». Отзыв нужен, чтобы
        получить сертификат, — и он же помогает следующим ученикам выбрать курс.
      </p>

      <div className="mt-3 flex items-center gap-1" role="radiogroup" aria-label="Оценка курса">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} из 5`}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5"
          >
            <Star
              className={
                n <= (hover || rating)
                  ? "size-7 fill-amber-400 text-amber-400"
                  : "size-7 text-foreground/20"
              }
            />
          </button>
        ))}
      </div>

      <label className="mt-3 block text-xs font-medium text-foreground/70" htmlFor="review-text">
        Ваш отзыв
      </label>
      <textarea
        id="review-text"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Например: до курса терялся на «дорого», теперь спокойно возвращаю разговор к ценности — две сделки за месяц."
        className="mt-1 block w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
      />
      <p className="mt-1 text-xs text-foreground/50">{text.trim().length} / минимум 40 символов</p>

      {isOrgLearner ? (
        <p className="mt-3 text-xs text-foreground/50">
          Отзыв будет опубликован обезличенно: имя работника компании платформа не хранит.
        </p>
      ) : (
        <>
          <label className="mt-3 block text-xs font-medium text-foreground/70" htmlFor="review-name">
            Имя для подписи отзыва
          </label>
          <input
            id="review-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: Алексей, руководитель отдела продаж"
            className="mt-1 block w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
          />
          <label className="mt-3 flex items-start gap-2 text-xs text-foreground/70">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 size-4 accent-amber-500"
            />
            <span>
              Согласен(на) на публикацию отзыва с этим именем на странице курса. Без согласия
              отзыв увидит только школа.
            </span>
          </label>
        </>
      )}

      {error ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <Button onClick={submit} disabled={pending} className="mt-4" variant="brand">
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Отправляем…
          </>
        ) : (
          <>
            <CheckCircle2 className="size-4" /> Отправить отзыв и открыть шаг 2
          </>
        )}
      </Button>
    </div>
  );
}
