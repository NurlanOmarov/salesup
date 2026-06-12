import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { env } from "@/env";
import { db } from "@/lib/db";
import { canAccessLesson, httpStatusForDeny } from "@/lib/access";
import { decryptHlsKey } from "@/lib/video/keys";

export const dynamic = "force-dynamic";

/**
 * Выдача AES-128 ключа для расшифровки HLS (CLAUDE.md, правило 2).
 *  GET /api/video/key/<lessonId> → 16 байт ключа, no-store.
 *
 * Отдельная и полная проверка доступа (canAccessLesson) на каждый запрос: ключ
 * не кэшируется, поэтому отзыв доступа закрывает видео при следующем запросе ключа
 * (seek/перезагрузка). Без ключа сегменты бесполезны — они зашифрованы.
 */
export async function GET(
  _req: Request,
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
    select: { videoAesKeyEnc: true, videoStatus: true },
  });
  if (!lesson?.videoAesKeyEnc || lesson.videoStatus !== "READY") {
    return new NextResponse("Key not available", { status: 404 });
  }

  let key: Buffer;
  try {
    key = decryptHlsKey(lesson.videoAesKeyEnc, env.VIDEO_KEY_ENC_SECRET);
  } catch {
    return new NextResponse("Key decode error", { status: 500 });
  }

  return new NextResponse(new Uint8Array(key), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
      "Content-Length": String(key.length),
    },
  });
}
