import { NextResponse } from "next/server";
import { env } from "@/env";
import { storage, normalizeKey } from "@/lib/storage";
import { PROMO_MEDIA_RE } from "@/lib/courses/promo-video";

export const dynamic = "force-dynamic";

/**
 * Промо-ролик курса, которого нет на YouTube (lib/courses/promo-video.ts).
 *  GET /api/promo/courses/<slug>/promo/<имя>.(mp4|jpg)
 *
 * Публично и без подписи: это реклама с витрины, а не урок. Отдаются ТОЛЬКО
 * файлы каталога promo — видео уроков этим путём не достать. На VPS файл
 * отдаёт nginx (X-Accel-Redirect в internal-локацию /promo-media/ с
 * кэшированием и Range для перемотки); локально без nginx — напрямую.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;

  let key: string;
  try {
    key = normalizeKey(path.join("/"));
  } catch {
    return new NextResponse("Bad key", { status: 400 });
  }
  if (!PROMO_MEDIA_RE.test(key)) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!(await storage.exists(key))) {
    return new NextResponse("Not found", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": key.endsWith(".mp4") ? "video/mp4" : "image/jpeg",
  };

  // Cache-Control на VPS ставит сама локация nginx — здесь не дублируем.
  if (env.VIDEO_XACCEL) {
    headers["X-Accel-Redirect"] = `/promo-media/${key}`;
    return new NextResponse(null, { headers });
  }

  headers["Cache-Control"] = "public, max-age=604800";

  const data = await storage.get(key);
  return new NextResponse(new Uint8Array(data), { headers });
}
