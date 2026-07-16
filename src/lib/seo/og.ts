import "server-only";
import { storage } from "@/lib/storage";

/**
 * Отдача кастомной OG-картинки из lib/storage для file-convention роутов
 * opengraph-image.tsx: если владелец загрузил свою картинку — отдаём её, иначе
 * вызывающий код рендерит авто-сгенерированную (satori). Ошибки → null (фолбэк),
 * чтобы OG никогда не ломал страницу.
 */
export async function ogFileResponse(key: string | null | undefined): Promise<Response | null> {
  if (!key || key.startsWith("/") || key.startsWith("http")) return null;
  try {
    if (!(await storage.exists(key))) return null;
    const buf = await storage.get(key);
    const ext = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
    const mime =
      ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "webp"
          ? "image/webp"
          : "image/png";
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": mime, "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return null;
  }
}
