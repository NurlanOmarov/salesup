"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { saveLessonProgress } from "@/app/(student)/app/learn/[courseSlug]/[lessonId]/actions";
import { usePlayerRegistration } from "@/components/player/player-context";

/**
 * Защищённый HLS-плеер (CLAUDE.md, правило 2 / S2.2). Источник — наш проксирующий
 * плейлист с подписанными сегментами; ключ AES — через защищённый эндпоинт.
 * Фичи: выбор скорости и качества, динамический водяной знак (e-mail, новая позиция
 * каждые 20–40 с) для анти-шеринга, блокировка контекстного меню, сохранение прогресса
 * (каждые 10 с и на паузу), старт с последней позиции.
 */

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const SAVE_INTERVAL_MS = 10_000;

interface Level {
  height: number;
  index: number;
}

export interface SubtitleTrackInfo {
  lang: "RU" | "KK" | "EN" | "UZ";
  label: string;
}

export function SecurePlayer({
  lessonId,
  watermark,
  startPositionSec = 0,
  subtitles = [],
  defaultSubtitleLang = null,
}: {
  lessonId: string;
  watermark: string;
  startPositionSec?: number;
  subtitles?: SubtitleTrackInfo[];
  defaultSubtitleLang?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const watchedRef = useRef(0); // секунды реального просмотра с последнего сохранения
  const lastTickRef = useRef<number | null>(null);
  const registerPlayer = usePlayerRegistration();

  const [levels, setLevels] = useState<Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1); // -1 = авто
  const [speed, setSpeed] = useState(1);
  const [subLang, setSubLang] = useState<string>(
    defaultSubtitleLang && subtitles.some((s) => s.lang === defaultSubtitleLang) ? defaultSubtitleLang : "off",
  );
  const [wmPos, setWmPos] = useState({ top: "10%", left: "10%" });
  const [error, setError] = useState<string | null>(null);

  const src = `/api/video/playlist/${lessonId}`;

  // ── Инициализация HLS ──────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        setLevels(
          data.levels.map((l, i) => ({ height: l.height, index: i })).reverse(),
        );
        if (startPositionSec > 0) video.currentTime = startPositionSec;
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => setCurrentLevel(hls.autoLevelEnabled ? -1 : data.level));
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setError("Не удалось загрузить видео. Обновите страницу.");
      });
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    // Safari — нативный HLS
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      const onMeta = () => {
        if (startPositionSec > 0) video.currentTime = startPositionSec;
      };
      video.addEventListener("loadedmetadata", onMeta);
      return () => video.removeEventListener("loadedmetadata", onMeta);
    }

    setError("Ваш браузер не поддерживает воспроизведение этого видео.");
  }, [src, startPositionSec]);

  // ── Регистрация управления плеером для панели заметок ──────────────────────
  useEffect(() => {
    registerPlayer({
      getCurrentTime: () => Math.floor(videoRef.current?.currentTime ?? 0),
      seek: (sec) => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = Math.max(0, sec);
        void video.play().catch(() => {});
      },
    });
    return () => registerPlayer(null);
  }, [registerPlayer]);

  // ── Динамический водяной знак ──────────────────────────────────────────────
  useEffect(() => {
    const move = () => {
      setWmPos({
        top: `${5 + Math.random() * 80}%`,
        left: `${5 + Math.random() * 70}%`,
      });
    };
    move();
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        move();
        schedule();
      }, 20_000 + Math.random() * 20_000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  // ── Сохранение прогресса ───────────────────────────────────────────────────
  const persist = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.currentTime <= 0) return;
    const watched = Math.round(watchedRef.current);
    watchedRef.current = 0;
    void saveLessonProgress({
      lessonId,
      positionSec: Math.floor(video.currentTime),
      watchedSec: watched,
    });
  }, [lessonId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTime = () => {
      const now = video.currentTime;
      if (lastTickRef.current !== null && !video.paused) {
        const delta = now - lastTickRef.current;
        if (delta > 0 && delta < 2) watchedRef.current += delta; // игнорируем seek
      }
      lastTickRef.current = now;
    };
    const onPause = () => persist();

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("pause", onPause);
    const interval = setInterval(persist, SAVE_INTERVAL_MS);
    const onUnload = () => persist();
    window.addEventListener("beforeunload", onUnload);

    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("pause", onPause);
      clearInterval(interval);
      window.removeEventListener("beforeunload", onUnload);
      persist();
    };
  }, [persist]);

  // ── Управление ─────────────────────────────────────────────────────────────
  const changeSpeed = (s: number) => {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
  };

  const changeQuality = (levelIndex: number) => {
    setCurrentLevel(levelIndex);
    if (hlsRef.current) hlsRef.current.currentLevel = levelIndex;
  };

  // Применяем выбранную дорожку субтитров через textTracks API.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tracks = video.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i]!;
      t.mode = t.language?.toUpperCase() === subLang ? "showing" : "disabled";
    }
  }, [subLang, subtitles.length]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video
        ref={videoRef}
        controls
        controlsList="nodownload"
        playsInline
        onContextMenu={(e) => e.preventDefault()}
        className="aspect-video w-full"
        crossOrigin="use-credentials"
      >
        {subtitles.map((t) => (
          <track
            key={t.lang}
            kind="subtitles"
            srcLang={t.lang.toLowerCase()}
            label={t.label}
            src={`/api/video/subtitle/${lessonId}/${t.lang}`}
            default={t.lang === subLang}
          />
        ))}
      </video>

      {/* Водяной знак — поверх видео, не перехватывает клики */}
      <div
        aria-hidden
        className="pointer-events-none absolute select-none text-xs font-medium text-white/30 transition-all duration-1000"
        style={{ top: wmPos.top, left: wmPos.left }}
      >
        {watermark}
      </div>

      {/* Панель управления качеством/скоростью */}
      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 bg-slate-950 px-3 py-2 text-xs text-white/70">
        <label className="flex items-center gap-1.5">
          Скорость:
          <select
            value={speed}
            onChange={(e) => changeSpeed(Number(e.target.value))}
            className="rounded bg-slate-800 px-1.5 py-0.5 text-white"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>

        {levels.length > 0 ? (
          <label className="flex items-center gap-1.5">
            Качество:
            <select
              value={currentLevel}
              onChange={(e) => changeQuality(Number(e.target.value))}
              className="rounded bg-slate-800 px-1.5 py-0.5 text-white"
            >
              <option value={-1}>Авто</option>
              {levels.map((l) => (
                <option key={l.index} value={l.index}>
                  {l.height}p
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {subtitles.length > 0 ? (
          <label className="flex items-center gap-1.5">
            Субтитры:
            <select
              value={subLang}
              onChange={(e) => setSubLang(e.target.value)}
              className="rounded bg-slate-800 px-1.5 py-0.5 text-white"
            >
              <option value="off">Выкл</option>
              {subtitles.map((t) => (
                <option key={t.lang} value={t.lang}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 p-4 text-center text-sm text-white">
          {error}
        </div>
      ) : null}
    </div>
  );
}
