import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { storage, normalizeKey } from "@/lib/storage";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".avif": "image/avif",
  ".gif": "image/gif",
};

/**
 * Публичная раздача обложки курса из lib/storage.
 *   GET /api/cover/<courseId>?v=<cacheBuster>
 *
 * course.coverUrl хранит либо статический путь (начинается с «/» или «http» —
 * сид-данные из public/), либо относительный ключ хранилища (залитый через
 * админку). Во втором случае файл отдаётся отсюда; версию подставляет
 * coverPublicUrl() для сброса кэша при смене фото.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { coverUrl: true },
  });
  const key = course?.coverUrl;
  if (!key) return new NextResponse("Not found", { status: 404 });

  // Статические пути (сид) отдаются Next/nginx напрямую — сюда не доходят,
  // но на всякий случай редиректим.
  if (key.startsWith("/") || key.startsWith("http")) {
    return NextResponse.redirect(key);
  }

  try {
    normalizeKey(key);
  } catch {
    return new NextResponse("Bad key", { status: 400 });
  }

  if (!(await storage.exists(key))) {
    return new NextResponse("Not found", { status: 404 });
  }

  const buf = await storage.get(key);
  const dot = key.lastIndexOf(".");
  const ext = dot >= 0 ? key.slice(dot).toLowerCase() : "";

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "image/webp",
      //_immutable: ключ меняется при каждой загрузке фото (?v=… сбрасывает кэш)
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
