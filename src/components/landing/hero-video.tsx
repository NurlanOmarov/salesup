"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Фоновый синемаграф hero-секции: тёмный кадр рабочего стола у окна,
 * единственное движение — пар от кофе и мерцание огней города.
 * Композиция: левая половина — тень (под текст), справа — предметы.
 *
 * Уважает prefers-reduced-motion: таким пользователям (и до загрузки видео)
 * показываем статичный постер, идентичный первому кадру.
 */
export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setPlay(true);
  }, []);

  useEffect(() => {
    if (play) videoRef.current?.play().catch(() => {});
  }, [play]);

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Постер виден всегда — как фон под видео и как fallback */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/landing/hero-poster.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 size-full object-cover object-right-bottom"
      />
      {play ? (
        <video
          ref={videoRef}
          className="absolute inset-0 size-full object-cover object-right-bottom"
          autoPlay
          loop
          muted
          playsInline
          poster="/landing/hero-poster.jpg"
          aria-hidden
        >
          <source src="/landing/hero-loop.webm" type="video/webm" />
          <source src="/landing/hero-loop.mp4" type="video/mp4" />
        </video>
      ) : null}

      {/* Оверлеи читаемости: плотные только слева, под заголовком. Правая треть
          остаётся чистой — там город, огни и пар, ради которых снят кадр. */}
      {/* на узких экранах текст идёт во всю ширину — затемняем кадр равномерно */}
      <div className="absolute inset-0 bg-slate-950/65 sm:hidden" />
      <div className="absolute inset-0 hidden bg-gradient-to-r from-slate-950 from-15% via-slate-950/70 via-50% to-transparent sm:block" />
      {/* лёгкая виньетка снизу — под полосу счётчиков */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
      {/* бренд-акцент — только по левому краю, чтобы не мылить город */}
      <div className="aurora-a absolute -top-32 -left-20 h-96 w-[40rem] rounded-full bg-brand/12 blur-3xl" />
    </div>
  );
}
