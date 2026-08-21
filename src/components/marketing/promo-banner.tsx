"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/i18n/client";
import { messagesFor } from "@/i18n/messages";

/**
 * Полоса акции «−50 %» под шапкой публичных страниц.
 *
 * Таймер запускается только после монтирования: на сервере «осталось» посчитать
 * нельзя без расхождения с клиентом (страницы кэшируются на 1–10 минут, ISR),
 * поэтому первый кадр показывает заголовок и дату, а обратный отсчёт появляется
 * миллисекундой позже. Так нет ни гидратационного mismatch, ни застывших цифр
 * из кэша.
 *
 * Когда акция закончилась, компонент исчезает сам — сервер перестаёт его
 * рендерить (promoActive), а уже открытая вкладка убирает полосу по таймеру.
 */
export function PromoBanner({
  endsAtIso,
  endsLabel,
}: {
  endsAtIso: string;
  endsLabel: string;
}) {
  const locale = useLocale();
  const t = messagesFor(locale).promo;
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const endsAt = Date.parse(endsAtIso);
    const tick = () => setLeft(endsAt - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAtIso]);

  if (left !== null && left <= 0) return null;

  const days = left === null ? null : Math.floor(left / 86_400_000);
  const hours = left === null ? null : Math.floor((left % 86_400_000) / 3_600_000);
  const minutes = left === null ? null : Math.floor((left % 3_600_000) / 60_000);
  const seconds = left === null ? null : Math.floor((left % 60_000) / 1000);

  return (
    <div className="bg-brand text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-sm">
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold tabular-nums">
          {t.badge}
        </span>
        <span className="font-semibold">{t.title}</span>
        <span className="text-white/80">{t.until(endsLabel)}</span>
        {days !== null ? (
          <span className="flex items-center gap-1 text-white/90">
            <span className="text-white/70">{t.left}:</span>
            <span className="font-semibold tabular-nums">
              {days} {t.days} {String(hours).padStart(2, "0")} {t.hours}{" "}
              {String(minutes).padStart(2, "0")} {t.minutes}{" "}
              {String(seconds).padStart(2, "0")} {t.seconds}
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
