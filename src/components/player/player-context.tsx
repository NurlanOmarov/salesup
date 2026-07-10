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

const PlayerContext = createContext<{ handle: React.MutableRefObject<PlayerHandle | null> } | null>(
  null,
);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const handle = useRef<PlayerHandle | null>(null);
  return <PlayerContext.Provider value={{ handle }}>{children}</PlayerContext.Provider>;
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
