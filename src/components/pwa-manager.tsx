"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

/**
 * Регистрирует service worker (только в production — чтобы не мешать HMR) и
 * показывает ненавязчивую плашку «Установить приложение», когда браузер готов
 * (событие beforeinstallprompt). Выбор пользователя запоминается в localStorage.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";

export function PwaManager() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      if (localStorage.getItem(DISMISS_KEY)) return;
      setPromptEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setVisible(false);
    setPromptEvent(null);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-2xl border border-amber-500/30 bg-background/95 p-4 shadow-lg backdrop-blur lg:bottom-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700">
          <Download className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Установить приложение</p>
          <p className="mt-0.5 text-sm text-foreground/60">
            Быстрый доступ к обучению с экрана телефона, как обычное приложение.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={install}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
            >
              Установить
            </button>
            <button
              onClick={dismiss}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-foreground/60 hover:bg-foreground/5"
            >
              Позже
            </button>
          </div>
        </div>
        <button onClick={dismiss} aria-label="Закрыть" className="text-foreground/30 hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
