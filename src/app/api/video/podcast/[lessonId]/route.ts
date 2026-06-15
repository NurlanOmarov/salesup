import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { env } from "@/env";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { canAccessLesson, httpStatusForDeny } from "@/lib/access";

export const dynamic = "force-dynamic";

/**
 * AI-подкаст урока: раздача двухголосого обзора (m4a), сгенерированного фабрикой
 * через NotebookLM (factory:podcast). Отдельный формат от аудиоверсии урока
 * (/api/video/audio/<id> — дорожка из видео).
 *  GET /api/video/podcast/<lessonId>
 *
 * Доступ — полная проверка canAccessLesson на каждый запрос: подкаст — тот же
 * платный контент. На VPS отдаёт nginx через X-Accel-Redirect; локально стримим
 * напрямую с поддержкой Range (перемотка в плеере).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const access = await canAccessLesson(userId, lessonId);
  if (!access.ok) return new NextResponse(access.reason, { status: httpStatusForDeny(access.reason) });

  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { podcastKey: true } });
  if (!lesson?.podcastKey || !(await storage.exists(lesson.podcastKey))) {
    return new NextResponse("Podcast not available", { status: 404 });
  }
  const key = lesson.podcastKey;

  // VPS: nginx отдаёт файл из internal-локации (поддерживает Range сам).
  if (env.VIDEO_XACCEL) {
    return new NextResponse(null, {
      headers: {
        "Content-Type": "audio/mp4",
        "Cache-Control": "private, max-age=14400",
        "X-Accel-Redirect": `/protected-media/${key}`,
      },
    });
  }

  // Локально: стримим с поддержкой Range, чтобы работала перемотка.
  const data = await storage.get(key);
  const total = data.length;
  const range = req.headers.get("range");
  const baseHeaders: Record<string, string> = {
    "Content-Type": "audio/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=14400",
  };

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? Number(m[1]) : 0;
    const end = m && m[2] ? Number(m[2]) : total - 1;
    if (start >= total || end >= total || start > end) {
      return new NextResponse("Range not satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${total}` },
      });
    }
    const chunk = data.subarray(start, end + 1);
    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Length": String(chunk.length),
      },
    });
  }

  return new NextResponse(new Uint8Array(data), {
    headers: { ...baseHeaders, "Content-Length": String(total) },
  });
}
