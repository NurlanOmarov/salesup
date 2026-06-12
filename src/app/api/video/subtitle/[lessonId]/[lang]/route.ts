import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { canAccessLesson, httpStatusForDeny } from "@/lib/access";

export const dynamic = "force-dynamic";

const LANGS = ["RU", "KK", "EN", "UZ"] as const;
type Lang = (typeof LANGS)[number];

/**
 * Защищённая раздача VTT-субтитров (CLAUDE.md S2.3): тем же каналом доступа, что
 * видео. Дорожка отдаётся только при доступе к уроку и только если VALIDATED.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lessonId: string; lang: string }> },
) {
  const { lessonId, lang } = await params;
  const upper = lang.toUpperCase();
  if (!LANGS.includes(upper as Lang)) return new NextResponse("Bad lang", { status: 400 });

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const access = await canAccessLesson(userId, lessonId);
  if (!access.ok) return new NextResponse(access.reason, { status: httpStatusForDeny(access.reason) });

  const track = await db.subtitleTrack.findUnique({
    where: { lessonId_lang: { lessonId, lang: upper as Lang } },
    select: { vttKey: true, validation: true },
  });
  if (!track || track.validation !== "VALIDATED") return new NextResponse("Not found", { status: 404 });
  if (!(await storage.exists(track.vttKey))) return new NextResponse("Not found", { status: 404 });

  const vtt = await storage.get(track.vttKey);
  return new NextResponse(new Uint8Array(vtt), {
    headers: { "Content-Type": "text/vtt; charset=utf-8", "Cache-Control": "private, max-age=3600" },
  });
}
