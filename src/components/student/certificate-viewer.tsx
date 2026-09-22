import { Download, ExternalLink, Mail } from "lucide-react";
import { CertificatePdfCanvas } from "./certificate-pdf-canvas";

/**
 * Выпущенный сертификат: превью PDF (canvas, работает и на Android) и кнопки
 * «Скачать» / «Открыть на весь экран». Файл отдаёт /api/certificate/<id> — только владельцу
 * сертификата (или OWNER), без кэширования.
 */
export function CertificateViewer({
  certificateId,
  number,
  sentNote,
}: {
  certificateId: string;
  number: string | null;
  sentNote: string | null;
}) {
  const src = `/api/certificate/${certificateId}`;
  return (
    <div className="mt-4">
      <CertificatePdfCanvas url={src} title={`Сертификат${number ? ` № ${number}` : ""}`} />
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`${src}?download=1`}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
        >
          <Download className="size-4" />
          Скачать PDF
        </a>
        <a
          href={src}
          target="_blank"
          rel="noopener"
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-foreground/15 px-4 text-sm font-semibold text-foreground/80 transition-colors hover:bg-foreground/5"
        >
          <ExternalLink className="size-4" />
          Открыть на весь экран
        </a>
      </div>
      {sentNote ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-foreground/60">
          <Mail className="size-3.5" />
          {sentNote}
        </p>
      ) : null}
    </div>
  );
}
