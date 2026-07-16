import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ogFileResponse } from "@/lib/seo/og";

export const dynamic = "force-dynamic";

/**
 * Отдача кастомной OG-картинки курса по id (превью в админке). Содержимое публичное
 * по своей природе (та же картинка отдаётся соцсетям через opengraph-image),
 * поэтому auth не требуется. 404 — если картинка не загружена.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { ogImageUrl: true },
  });
  const res = await ogFileResponse(course?.ogImageUrl);
  if (!res) return new NextResponse("Not found", { status: 404 });
  return res;
}
