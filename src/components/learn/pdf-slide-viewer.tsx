"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Download,
  Loader2,
  FileWarning,
} from "lucide-react";

/**
 * Просмотрщик PDF-презентации урока (дизайнерская колода NotebookLM Slide Deck).
 *
 * Рендерит страницы PDF в <canvas> постранично (pdfjs-dist, worker из /public) и
 * листает их как слайдер — стрелками, клавишами ←/→, свайпом и точками; есть
 * полноэкранный режим и кнопка скачивания. Визуально повторяет <SlideDeck>, чтобы
 * не выбиваться из кабинета. Заменяет HTML-колоду, когда у урока есть PDF.
 *
 * PDF берётся из /api/learn/slides-pdf/<lessonId> (проверка доступа + X-Accel);
 * запрос same-origin, cookie сессии уходят автоматически.
 */

// pdfjs типизируем минимально — импорт динамический (только на клиенте, без SSR).
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage>; destroy: () => void };
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => {
    promise: Promise<void>;
    cancel: () => void;
  };
};

export function PdfSlideViewer({ lessonId }: { lessonId: string }) {
  const url = `/api/learn/slides-pdf/${lessonId}`;
  const downloadUrl = `${url}?download=1`;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PdfDoc | null>(null);

  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1); // 1-индексация, как в pdfjs
  const [dir, setDir] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [fs, setFs] = useState(false);
  const [width, setWidth] = useState(0);

  // Загрузка документа (один раз на lessonId).
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = (await pdfjs.getDocument({ url }).promise) as unknown as PdfDoc;
        if (cancelled) {
          doc.destroy();
          return;
        }
        docRef.current = doc;
        setNumPages(doc.numPages);
        setPage(1);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      docRef.current?.destroy();
      docRef.current = null;
    };
  }, [url]);

  // Отслеживаем ширину контейнера (для чёткого рендера под размер).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Рендер текущей страницы в canvas при смене страницы/ширины/готовности.
  useEffect(() => {
    if (status !== "ready" || !docRef.current || width === 0) return;
    let task: { cancel: () => void } | null = null;
    let cancelled = false;
    (async () => {
      const doc = docRef.current!;
      const p = await doc.getPage(page);
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const base = p.getViewport({ scale: 1 });
      const scale = (width / base.width) * dpr;
      const vp = p.getViewport({ scale });
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      const renderTask = p.render({ canvasContext: ctx, viewport: vp });
      task = renderTask;
      try {
        await renderTask.promise;
      } catch {
        /* отменённый рендер при быстром перелистывании — не ошибка */
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [status, page, width]);

  const go = useCallback(
    (next: number) => {
      setPage((cur) => {
        const clamped = Math.max(1, Math.min(numPages, next));
        setDir(clamped >= cur ? 1 : -1);
        return clamped;
      });
    },
    [numPages],
  );
  const prev = useCallback(() => go(page - 1), [go, page]);
  const next = useCallback(() => go(page + 1), [go, page]);

  // Клавиатура ←/→ (пока просмотрщик смонтирован), как в SlideDeck.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const toggleFs = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }, []);
  useEffect(() => {
    const onChange = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const onDragEnd = (_e: unknown, info: PanInfo) => {
    if (info.offset.x < -60 || info.velocity.x < -300) next();
    else if (info.offset.x > 60 || info.velocity.x > 300) prev();
  };

  return (
    <div
      ref={containerRef}
      className={`group relative overflow-hidden rounded-2xl border border-foreground/10 bg-background ${
        fs ? "flex h-screen flex-col justify-center bg-foreground/[0.02]" : ""
      }`}
    >
      {/* Прогресс-полоса */}
      <div className="absolute inset-x-0 top-0 z-20 h-1 bg-foreground/10">
        <motion.div
          className="h-full bg-amber-500"
          animate={{ width: `${numPages ? (page / numPages) * 100 : 0}%` }}
          transition={{ type: "spring", stiffness: 220, damping: 30 }}
        />
      </div>

      {/* Сцена: держим 16:9 на десктопе, тянемся по контенту на мобильном */}
      <div className="relative flex min-h-[440px] items-center justify-center sm:aspect-[16/9] sm:min-h-0">
        {status === "loading" ? (
          <div className="flex flex-col items-center gap-2 text-foreground/50">
            <Loader2 className="size-6 animate-spin" />
            <span className="text-sm">Загружаю презентацию…</span>
          </div>
        ) : status === "error" ? (
          <div className="flex flex-col items-center gap-2 px-6 text-center text-foreground/60">
            <FileWarning className="size-7 text-amber-600" />
            <span className="text-sm">Не удалось открыть презентацию.</span>
            <a href={downloadUrl} className="text-sm font-medium text-amber-700 underline">
              Скачать PDF
            </a>
          </div>
        ) : (
          <AnimatePresence custom={dir} mode="popLayout" initial={false}>
            <motion.div
              key={page}
              custom={dir}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={onDragEnd}
              initial={{ opacity: 0, x: dir * 48 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -48 }}
              transition={{ type: "spring", stiffness: 260, damping: 32 }}
              className="absolute inset-0 flex cursor-grab touch-pan-y items-center justify-center active:cursor-grabbing"
            >
              <canvas ref={canvasRef} className="max-h-full w-full object-contain" />
            </motion.div>
          </AnimatePresence>
        )}

        {/* Стрелки по краям (десктоп) */}
        {status === "ready" ? (
          <>
            <button
              aria-label="Предыдущий слайд"
              onClick={prev}
              disabled={page === 1}
              className="absolute left-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-foreground/10 bg-background/80 p-2 text-foreground/70 shadow-sm backdrop-blur transition hover:bg-background disabled:opacity-0 sm:block"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              aria-label="Следующий слайд"
              onClick={next}
              disabled={page === numPages}
              className="absolute right-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-foreground/10 bg-background/80 p-2 text-foreground/70 shadow-sm backdrop-blur transition hover:bg-background disabled:opacity-0 sm:block"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        ) : null}
      </div>

      {/* Панель управления */}
      <div className="flex items-center justify-between gap-3 border-t border-foreground/10 px-3 py-2.5">
        <button
          aria-label="Предыдущий слайд"
          onClick={prev}
          disabled={status !== "ready" || page === 1}
          className="rounded-lg border border-foreground/15 p-1.5 text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-30 sm:hidden"
        >
          <ChevronLeft className="size-4" />
        </button>

        {/* Точки навигации (до 20 страниц — иначе только счётчик) */}
        <div className="flex flex-1 items-center justify-center gap-1.5">
          {status === "ready" && numPages <= 20
            ? Array.from({ length: numPages }, (_, i) => (
                <button
                  key={i}
                  aria-label={`Слайд ${i + 1}`}
                  onClick={() => go(i + 1)}
                  className={`h-1.5 rounded-full transition-all ${
                    i + 1 === page ? "w-5 bg-amber-500" : "w-1.5 bg-foreground/20 hover:bg-foreground/40"
                  }`}
                />
              ))
            : null}
        </div>

        <button
          aria-label="Следующий слайд"
          onClick={next}
          disabled={status !== "ready" || page === numPages}
          className="rounded-lg border border-foreground/15 p-1.5 text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-30 sm:hidden"
        >
          <ChevronRight className="size-4" />
        </button>

        {status === "ready" ? (
          <span className="hidden text-xs tabular-nums text-foreground/50 sm:inline">
            {page} / {numPages}
          </span>
        ) : null}

        <a
          href={downloadUrl}
          aria-label="Скачать презентацию (PDF)"
          className="rounded-lg border border-foreground/15 p-1.5 text-foreground/70 transition hover:bg-foreground/5"
        >
          <Download className="size-4" />
        </a>
        <button
          aria-label={fs ? "Выйти из полноэкранного режима" : "Полный экран"}
          onClick={toggleFs}
          className="hidden rounded-lg border border-foreground/15 p-1.5 text-foreground/70 transition hover:bg-foreground/5 sm:block"
        >
          {fs ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
      </div>
    </div>
  );
}
