"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Промо-ролик курса: источник — YouTube, копии у нас нет (правило 10 — диск VPS
 * держим под уроки, а не под маркетинг).
 *
 * До клика грузится только превью-кадр: iframe YouTube тянет около мегабайта
 * скриптов и ставит куки, поэтому появляется он лишь по нажатию (домен nocookie,
 * rel=0 — после ролика не подсовываются чужие каналы).
 *
 * `vertical` — ролик снят вертикально (Shorts): рамка 9:16 и узкая колонка,
 * иначе кадр утонет в чёрных полях внутри 16:9.
 */
export function PromoVideo({
  videoId,
  title,
  vertical = false,
}: {
  videoId: string;
  title: string;
  vertical?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  // У вертикальных роликов кадр в исходных пропорциях лежит в oardefault;
  // maxres для них — тот же кадр с полями. При 404 откатываемся на hqdefault.
  const [thumb, setThumb] = useState(
    `https://i.ytimg.com/vi/${videoId}/${vertical ? "oardefault" : "maxresdefault"}.jpg`,
  );

  const frameCls = cn(
    "relative overflow-hidden rounded-2xl bg-slate-950",
    vertical ? "mx-auto aspect-[9/16] w-full max-w-xs sm:max-w-sm" : "aspect-video w-full",
  );

  if (playing) {
    return (
      <div className={frameCls}>
        <iframe
          className="absolute inset-0 size-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Смотреть видео: ${title}`}
      className={cn(frameCls, "group block")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumb}
        alt=""
        aria-hidden
        loading="lazy"
        onError={() => setThumb(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`)}
        className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
      />
      <span className="absolute inset-0 bg-slate-950/25 transition-colors group-hover:bg-slate-950/10" />
      <span className="absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-white shadow-lg transition-transform duration-200 group-hover:scale-110 sm:size-20">
        <Play className="ml-1 size-7 fill-current sm:size-9" />
      </span>
    </button>
  );
}
