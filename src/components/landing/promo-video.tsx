"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PromoVideo } from "@/lib/courses/promo-video";

/**
 * Промо-ролики курса: источник — YouTube, копий у нас нет (правило 10 — диск VPS
 * держим под уроки, а не под маркетинг).
 *
 * До клика грузится только превью-кадр: iframe YouTube тянет около мегабайта
 * скриптов и ставит куки, поэтому появляется он лишь по нажатию (домен nocookie,
 * rel=0 — после ролика не подсовываются чужие каналы).
 */
export function PromoVideos({
  videos,
  courseTitle,
}: {
  videos: PromoVideo[];
  courseTitle: string;
}) {
  if (videos.length === 0) return null;

  // Один ролик — крупно; несколько — сеткой. Вертикальные шортсы узкие, поэтому
  // в ряд их помещается три, а горизонтальным хватает двух колонок.
  if (videos.length === 1) {
    const only = videos[0]!;
    return (
      <div className={only.vertical ? "mx-auto w-full max-w-xs sm:max-w-sm" : undefined}>
        <PromoVideoItem video={only} courseTitle={courseTitle} />
      </div>
    );
  }

  const allVertical = videos.every((v) => v.vertical);

  return (
    <div
      className={cn(
        allVertical
          ? // Шортсы: на телефоне — лента со снэпом (три кадра 9:16 в столбик
            // это три экрана прокрутки), на десктопе — ровный ряд.
            "-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden"
          : "grid gap-5 sm:grid-cols-2",
      )}
    >
      {videos.map((v) => (
        <PromoVideoItem
          key={v.id}
          video={v}
          courseTitle={courseTitle}
          className={
            allVertical
              ? "w-[68vw] max-w-xs shrink-0 snap-center sm:w-auto sm:max-w-none"
              : undefined
          }
        />
      ))}
    </div>
  );
}

function PromoVideoItem({
  video,
  courseTitle,
  className,
}: {
  video: PromoVideo;
  courseTitle: string;
  className?: string;
}) {
  const { id, vertical, title } = video;
  const [playing, setPlaying] = useState(false);
  // У вертикальных роликов кадр в исходных пропорциях лежит в oardefault;
  // maxres для них — тот же кадр с полями. При 404 откатываемся на hqdefault.
  const [thumb, setThumb] = useState(
    `https://i.ytimg.com/vi/${id}/${vertical ? "oardefault" : "maxresdefault"}.jpg`,
  );

  const label = title ? `${title} — ${courseTitle}` : courseTitle;
  const frameCls = cn(
    "relative w-full overflow-hidden rounded-2xl bg-slate-950",
    vertical ? "aspect-[9/16]" : "aspect-video",
  );

  return (
    <figure className={className}>
      {playing ? (
        <div className={frameCls}>
          <iframe
            className="absolute inset-0 size-full"
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`}
            title={label}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Смотреть видео: ${label}`}
          className={cn(frameCls, "group block")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt=""
            aria-hidden
            loading="lazy"
            onError={() => setThumb(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`)}
            className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
          <span className="absolute inset-0 bg-slate-950/25 transition-colors group-hover:bg-slate-950/10" />
          <span className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-white shadow-lg transition-transform duration-200 group-hover:scale-110 sm:size-16">
            <Play className="ml-1 size-6 fill-current sm:size-7" />
          </span>
        </button>
      )}
      {title ? (
        <figcaption className="mt-2 text-center text-sm text-foreground/60">
          {title}
        </figcaption>
      ) : null}
    </figure>
  );
}
