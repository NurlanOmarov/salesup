import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { env } from "@/env";
import { storage } from "@/lib/storage";
import { normalizeKey } from "@/lib/storage";
import { verifySegment } from "@/lib/video/signing";
import { parseSegmentKey } from "@/lib/video/hls-rewrite";

export const dynamic = "force-dynamic";

/**
 * Раздача зашифрованного HLS-сегмента (CLAUDE.md, правило 2).
 *  GET /api/video/media/<key>?exp=<ts>&sig=<hmac>
 *
 * Проверка — только подпись + сессия (без БД, быстро: сегментов много).
 * Подпись привязана к userId, поэтому ссылку нельзя использовать в другой сессии;
 * exp ограничивает срок. На VPS файл отдаёт nginx через X-Accel-Redirect
 * (VIDEO_XACCEL=true); локально без nginx — стрим напрямую.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  let key: string;
  try {
    key = normalizeKey(path.join("/"));
  } catch {
    return new NextResponse("Bad key", { status: 400 });
  }

  // Принимаем только ключи сегментов (defense-in-depth поверх подписи).
  if (!parseSegmentKey(key)) {
    return new NextResponse("Not a segment", { status: 400 });
  }

  const expRaw = req.nextUrl.searchParams.get("exp");
  const sig = req.nextUrl.searchParams.get("sig");
  const expSec = Number(expRaw);
  if (!sig || !Number.isFinite(expSec)) {
    return new NextResponse("Missing signature", { status: 400 });
  }

  const verdict = verifySegment({
    userId,
    key,
    expSec,
    sig,
    secret: env.VIDEO_SIGNING_SECRET,
    nowSec: Math.floor(Date.now() / 1000),
  });
  if (verdict !== null) {
    return new NextResponse(verdict, { status: 403 });
  }

  if (!(await storage.exists(key))) {
    return new NextResponse("Not found", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "video/mp2t",
    "Cache-Control": "private, max-age=14400",
  };

  // VPS: отдаёт nginx из internal-локации, приложение не качает файл сквозь себя.
  if (env.VIDEO_XACCEL) {
    headers["X-Accel-Redirect"] = `/protected-media/${key}`;
    return new NextResponse(null, { headers });
  }

  // Локально: стримим содержимое напрямую.
  const data = await storage.get(key);
  return new NextResponse(new Uint8Array(data), { headers });
}
