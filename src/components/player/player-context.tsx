"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";

/**
 * Мост между плеером и остальными вкладками урока (заметки): плеер регистрирует
 * способ прочитать текущую секунду и перемотать, а панель заметок этим пользуется,
 * не будучи дочерним элементом плеера. Через ref — чтобы перерисовки плеера не
 * дёргали потребителей.
 */
export interface PlayerHandle {
  getCurrentTime: () => number;
  seek: (sec: number) => void;
}

const PlayerContext = createContext<{
  handle: React.MutableRefObject<PlayerHandle | null>;
  onEnded: React.MutableRefObject<(() => void) | undefined>;
} | null>(null);

/** onEnded — видео досмотрено до конца (урок предлагает следующий шаг — тренировку). */
export function PlayerProvider({ children, onEnded }: { children: ReactNode; onEnded?: () => void }) {
  const handle = useRef<PlayerHandle | null>(null);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
  return <PlayerContext.Provider value={{ handle, onEnded: endedRef }}>{children}</PlayerContext.Provider>;
}

/** Плеер сообщает, что видео закончилось. */
export function usePlayerEnded(): () => void {
  const ctx = useContext(PlayerContext);
  return () => ctx?.onEnded.current?.();
}

/** Плеер вызывает это, чтобы зарегистрировать управление (или null, если плеера нет). */
export function usePlayerRegistration(): (h: PlayerHandle | null) => void {
  const ctx = useContext(PlayerContext);
  return (h) => {
    if (ctx) ctx.handle.current = h;
  };
}

/** Потребители (заметки) получают текущее управление плеером; null — если плеера нет. */
export function usePlayerControls(): PlayerHandle | null {
  const ctx = useContext(PlayerContext);
  return ctx?.handle.current ?? null;
}

/** Возвращает сам ref — для случаев, когда управление нужно прочитать в момент клика. */
export function usePlayerHandleRef() {
  return useContext(PlayerContext)?.handle ?? null;
}
