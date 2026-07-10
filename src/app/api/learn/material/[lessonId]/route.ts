import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canAccessLesson } from "@/lib/access";
import { parseChecklist } from "@/lib/interactive";
import { renderMaterialPdf } from "@/lib/learn/material-pdf";

export const dynamic = "force-dynamic";

/**
 * Скачивание учебного материала урока в PDF: ?type=summary | checklist.
 * Доступ к контенту — только через lib/access (CLAUDE.md, правило 1). Отдаём лишь
 * провалидированные критиком артефакты (правило 5).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId } = await params;
  const type = new URL(req.url).searchParams.get("type");
  if (type !== "summary" && type !== "checklist") {
    return new NextResponse("Bad request", { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const access = await canAccessLesson(userId, lessonId);
  if (!access.ok) return new NextResponse("Forbidden", { status: 403 });

  const artifactType = type === "summary" ? "SUMMARY" : "CHECKLIST";
  const [artifact, lesson] = await Promise.all([
    db.aiArtifact.findUnique({
      where: { lessonId_type: { lessonId, type: artifactType } },
      select: { content: true, validation: true },
    }),
    db.lesson.findUnique({
      where: { id: lessonId },
      select: { title: true, module: { select: { course: { select: { title: true } } } } },
    }),
  ]);
  if (!artifact || artifact.validation !== "VALIDATED" || !lesson) {
    return new NextResponse("Not found", { status: 404 });
  }

  const courseTitle = lesson.module.course.title;
  let pdf: Uint8Array;
  if (type === "summary") {
    pdf = await renderMaterialPdf({
      courseTitle,
      lessonTitle: lesson.title,
      heading: "Конспект",
      summary: artifact.content,
    });
  } else {
    const checklist = parseChecklist(artifact.content);
    if (!checklist) return new NextResponse("Not found", { status: 404 });
    pdf = await renderMaterialPdf({
      courseTitle,
      lessonTitle: lesson.title,
      heading: "Чек-лист подготовки",
      checklist,
    });
  }

  // ASCII-фолбэк для filename (заголовок — ByteString, кириллицу нельзя), плюс
  // человекочитаемое UTF-8 имя через filename* (RFC 5987).
  const asciiName = `${asciiSlug(lesson.title) || type}-${type}.pdf`;
  const utf8Name = `${lesson.title}-${type === "summary" ? "конспект" : "чек-лист"}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(utf8Name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** ASCII-слаг (только латиница/цифры) для безопасного filename в заголовке. */
function asciiSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
