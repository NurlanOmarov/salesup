// Копирует worker pdfjs-dist в public/ перед dev/build, чтобы отдавать его статикой
// (public/ включается в Docker standalone). Версия worker'а гарантированно совпадает
// с установленным pdfjs-dist — просмотрщик PDF-презентации (pdf-slide-viewer) ссылается
// на /pdf.worker.min.mjs. Детерминированно, без магии бандлера.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const src = join(dirname(require.resolve("pdfjs-dist/package.json")), "build", "pdf.worker.min.mjs");
const dest = join(process.cwd(), "public", "pdf.worker.min.mjs");

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`[copy-pdf-worker] ${src} → ${dest}`);
