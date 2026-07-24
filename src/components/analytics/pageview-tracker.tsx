"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Универсальный счётчик просмотров публичных страниц → своя таблица Event (D-002).
 * Подключён в (marketing)/layout, поэтому трекает ЛЮБУЮ публичную страницу по её
 * pathname — включая витрины новых курсов /courses/<slug> АВТОМАТИЧЕСКИ: добавлять
 * новый курс в счётчик вручную не нужно. Кабинет ученика/админку не трекаем (ПДн).
 *
 * Уникальные посетители считаются по анонимному id из localStorage (случайный, к
 * личности не привязан). Одна отправка на смену пути; ошибки проглатываются.
 */

const VISITOR_KEY = "as_vid";

/** Достаёт (или создаёт) анонимный visitor-id. При недоступном localStorage — "anon". */
function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const body = JSON.stringify({
      path: pathname,
      v: getVisitorId(),
      ref: document.referrer || null,
    });
    // keepalive — доставка не прервётся при быстром уходе со страницы.
    void fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
