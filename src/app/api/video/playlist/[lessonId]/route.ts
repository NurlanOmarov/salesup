import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { env } from "@/env";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { canAccessLesson, httpStatusForDeny } from "@/lib/access";
import { rewriteMasterPlaylist, rewriteMediaPlaylist } from "@/lib/video/hls-rewrite";
import { signSegment, segmentExpiry } from "@/lib/video/signing";

export const dynamic = "force-dynamic";

const M3U8 = "application/vnd.apple.mpegurl";

/**
 * Защищённая раздача HLS-плейлистов (CLAUDE.md, правило 2).
 *  GET /api/video/playlist/<lessonId>        → master.m3u8 (ссылки на варианты проксируются)
 *  GET /api/video/playlist/<lessonId>?v=720p → variant playlist (сегменты подписаны, URI ключа — наш эндпоинт)
 *
 * Доступ проверяется здесь (canAccessLesson). Сегментные URL подписываются
 * HMAC(userId+key+exp ≤ 4 ч), поэтому действительны только в этой сессии и ограниченно по времени.
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
  if (!access.ok) {
    return new NextResponse(access.reason, { status: httpStatusForDeny(access.reason) });
  }

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { videoKey: true, videoStatus: true },
  });
  if (!lesson?.videoKey || lesson.videoStatus !== "READY") {
    return new NextResponse("Video not ready", { status: 404 });
  }

  const prefix = lesson.videoKey; // courses/<slug>/lessons/<id>
  const variant = req.nextUrl.searchParams.get("v");
  const keyUrl = `/api/video/key/${lessonId}`;

  // ── Variant playlist (720p / 480p): подписываем сегменты ───────────────────
  if (variant) {
    if (!/^\d+p$/.test(variant)) {
      return new NextResponse("Bad variant", { status: 400 });
    }
    const playlistKey = `${prefix}/${variant}/playlist.m3u8`;
    if (!(await storage.exists(playlistKey))) {
      return new NextResponse("Not found", { status: 404 });
    }
    const content = (await storage.get(playlistKey)).toString("utf8");
    const exp = segmentExpiry(Math.floor(Date.now() / 1000));

    const rewritten = rewriteMediaPlaylist(
      content,
      (segName) => {
        const segKey = `${prefix}/${variant}/${segName}`;
        const sig = signSegment(userId, segKey, exp, env.VIDEO_SIGNING_SECRET);
        return `/api/video/media/${segKey}?exp=${exp}&sig=${sig}`;
      },
      keyUrl,
    );
    return new NextResponse(rewritten, {
      headers: { "Content-Type": M3U8, "Cache-Control": "no-store" },
    });
  }

  // ── Master playlist: проксируем ссылки на варианты ─────────────────────────
  const masterKey = `${prefix}/master.m3u8`;
  if (!(await storage.exists(masterKey))) {
    return new NextResponse("Not found", { status: 404 });
  }
  const master = (await storage.get(masterKey)).toString("utf8");
  const rewritten = rewriteMasterPlaylist(
    master,
    (v) => `/api/video/playlist/${lessonId}?v=${v}`,
  );
  return new NextResponse(rewritten, {
    headers: { "Content-Type": M3U8, "Cache-Control": "no-store" },
  });
}
