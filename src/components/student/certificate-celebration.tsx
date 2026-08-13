"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";

/**
 * Салют при первом заходе на «Мои сертификаты» после выдачи сертификата.
 *
 * Два предохранителя, чтобы праздник не превратился в фон: страница отдаёт только
 * недавно выданные сертификаты, а показанные id запоминаются в localStorage —
 * при следующих заходах салюта уже не будет. Палитра та же, что при сдаче теста
 * (quiz-runner), чтобы «победа» выглядела в продукте одинаково.
 */

const STORAGE_KEY = "celebratedCertificates";
/** Храним ограниченный хвост id: список растёт, а польза от старых записей нет. */
const KEEP_LAST = 50;

export function CertificateCelebration({ certificateIds }: { certificateIds: string[] }) {
  // Строковый ключ вместо массива: у массива каждый рендер новая ссылка.
  const key = certificateIds.join(",");

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let celebrated: string[] = [];
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(parsed)) {
        celebrated = parsed.filter((v): v is string => typeof v === "string");
      }
    } catch {
      // повреждённое значение — считаем, что не праздновали ничего
    }

    const fresh = ids.filter((id) => !celebrated.includes(id));
    if (fresh.length === 0) return;

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([...celebrated, ...fresh].slice(-KEEP_LAST)),
      );
    } catch {
      // приватный режим: салют покажется ещё раз, это не повод его отменять
    }

    void confetti({
      particleCount: 140,
      spread: 75,
      origin: { y: 0.6 },
      colors: ["#f59e0b", "#10b981", "#6366f1"],
    });
  }, [key]);

  return null;
}
