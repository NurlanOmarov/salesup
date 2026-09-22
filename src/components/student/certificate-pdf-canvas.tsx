"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, FileWarning } from "lucide-react";

/**
 * Превью сертификата: первая страница PDF в <canvas> (pdfjs-dist, worker из
 * /public — как в PdfSlideViewer). Встроенный просмотрщик браузера (<iframe>)
 * не годится: Chrome на Android PDF в iframe не показывает вовсе, а ученики
 * смотрят кабинет в основном с телефона.
 */

type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
};
type PdfDoc = { getPage: (n: number) => Promise<PdfPage>; destroy: () => void };

export function CertificatePdfCanvas({ url, title }: { url: string; title: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    let doc: PdfDoc | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        doc = (await pdfjs.getDocument({ url }).promise) as unknown as PdfDoc;
        const page = await doc.getPage(1);
        const canvas = canvasRef.current;
        const box = boxRef.current;
        if (cancelled || !canvas || !box) return;
        // Рендер в разрешении экрана: иначе на телефоне с DPR 3 текст мылится.
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (box.clientWidth / base.width) * dpr });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas");
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      doc?.destroy();
    };
  }, [url]);

  return (
    <div ref={boxRef} className="relative aspect-[842/595] w-full overflow-hidden rounded-xl border border-foreground/10 bg-foreground/[0.03]">
      <canvas ref={canvasRef} role="img" aria-label={title} className="size-full" />
      {status !== "ready" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-foreground/50">
          {status === "loading" ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <>
              <FileWarning className="size-6" />
              Не удалось показать превью — откройте или скачайте PDF кнопками ниже.
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
