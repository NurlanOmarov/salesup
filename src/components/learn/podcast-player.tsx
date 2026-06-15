"use client";

import { useRef, useState } from "react";
import { Play, Pause, Headphones, Podcast, RotateCcw, RotateCw, Gauge, type LucideIcon } from "lucide-react";

/**
 * Аудиоплеер урока в двух вариантах (один компонент, разные источники/оформление):
 *  - "audio"   — аудиоверсия урока: озвучка лекции, дорожка из видео (audioKey),
 *                раздаётся /api/video/audio/<id>;
 *  - "podcast" — AI-подкаст: двухголосый обзор-диалог (NotebookLM, podcastKey),
 *                раздаётся /api/video/podcast/<id>.
 * Источник в обоих случаях защищён (ключ + проверка доступа), на VPS — X-Accel.
 */
const SPEEDS = [1, 1.25, 1.5, 2];

type Variant = "audio" | "podcast";

const VARIANTS: Record<
  Variant,
  { endpoint: string; icon: LucideIcon; title: string; subtitle: string; accent: string; iconWrap: string; button: string }
> = {
  audio: {
    endpoint: "audio",
    icon: Headphones,
    title: "Аудиоверсия урока",
    subtitle: "Озвучка лекции — слушайте в дороге",
    accent: "from-violet-500/[0.07]",
    iconWrap: "bg-violet-500/15 text-violet-600",
    button: "bg-violet-500 hover:bg-violet-400",
  },
  podcast: {
    endpoint: "podcast",
    icon: Podcast,
    title: "Подкаст-обзор",
    subtitle: "Два ведущих разбирают урок — живой формат",
    accent: "from-amber-500/[0.08]",
    iconWrap: "bg-amber-500/15 text-amber-600",
    button: "bg-amber-500 hover:bg-amber-400",
  },
};

function fmt(sec: number): string {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function AudioPlayer({ lessonId, variant = "audio" }: { lessonId: string; variant?: Variant }) {
  const cfg = VARIANTS[variant];
  const Icon = cfg.icon;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play();
    else a.pause();
  };

  const seek = (delta: number) => {
    const a = audioRef.current;
    if (a) a.currentTime = Math.max(0, Math.min(dur, a.currentTime + delta));
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next]!;
  };

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (a) a.currentTime = Number(e.target.value);
  };

  return (
    <div className={`rounded-2xl border border-foreground/10 bg-gradient-to-br ${cfg.accent} to-transparent p-5 sm:p-6`}>
      <div className="flex items-center gap-3">
        <div className={`flex size-12 items-center justify-center rounded-2xl ${cfg.iconWrap}`}>
          <Icon className="size-6" />
        </div>
        <div>
          <p className="font-semibold">{cfg.title}</p>
          <p className="text-sm text-foreground/55">{cfg.subtitle}</p>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={`/api/video/${cfg.endpoint}/${lessonId}`}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
      />

      {/* Прогресс */}
      <div className="mt-5">
        <input
          type="range"
          min={0}
          max={dur || 0}
          value={cur}
          onChange={onScrub}
          className={`h-1.5 w-full cursor-pointer appearance-none rounded-full bg-foreground/15 ${variant === "podcast" ? "accent-amber-500" : "accent-violet-500"}`}
        />
        <div className="mt-1.5 flex justify-between text-xs text-foreground/50">
          <span>{fmt(cur)}</span>
          <span>{fmt(dur)}</span>
        </div>
      </div>

      {/* Управление */}
      <div className="mt-3 flex items-center justify-center gap-5">
        <button onClick={() => seek(-15)} className="text-foreground/60 transition-colors hover:text-foreground" aria-label="Назад 15 секунд">
          <RotateCcw className="size-5" />
        </button>
        <button
          onClick={toggle}
          className={`flex size-14 items-center justify-center rounded-full text-white transition-colors ${cfg.button}`}
          aria-label={playing ? "Пауза" : "Воспроизвести"}
        >
          {playing ? <Pause className="size-6" /> : <Play className="size-6 translate-x-0.5" />}
        </button>
        <button onClick={() => seek(15)} className="text-foreground/60 transition-colors hover:text-foreground" aria-label="Вперёд 15 секунд">
          <RotateCw className="size-5" />
        </button>
        <button
          onClick={cycleSpeed}
          className="inline-flex items-center gap-1 rounded-lg border border-foreground/15 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-foreground/5"
        >
          <Gauge className="size-3.5" />
          {SPEEDS[speedIdx]}×
        </button>
      </div>
    </div>
  );
}
