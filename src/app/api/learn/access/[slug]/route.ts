import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canAccessCourse } from "@/lib/access";
import { nextLesson } from "@/lib/learn/progress";

export const dynamic = "force-dynamic";

/**
 * Лёгкая проверка «есть ли у текущего пользователя активный доступ к курсу»
 * для витринной страницы /courses/[slug]: она остаётся статической (ISR),
 * а CTA подменяется на клиенте по ответу этого роута.
 * Доступ — только через lib/access (CLAUDE.md, правило 1).
 * Ответ намеренно не различает «не залогинен» и «нет доступа».
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const noStore = { "Cache-Control": "no-store" };
  const inactive = NextResponse.json({ active: false }, { headers: noStore });

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return inactive;

  const access = await canAccessCourse(userId, slug);
  if (!access.ok) return inactive;

  // Ссылка «Продолжить» — первый непройденный опубликованный урок (как в кабинете).
  const course = await db.course.findUnique({
    where: { slug },
    select: {
      modules: {
        orderBy: { sortOrder: "asc" },
        select: {
          lessons: {
            where: { status: "PUBLISHED" },
            orderBy: { sortOrder: "asc" },
            select: { id: true },
          },
        },
      },
    },
  });
  if (!course) return inactive;

  const lessons = course.modules.flatMap((m) => m.lessons);
  const completed = await db.lessonProgress.findMany({
    where: {
      userId,
      completedAt: { not: null },
      lessonId: { in: lessons.map((l) => l.id) },
    },
    select: { lessonId: true },
  });
  const done = new Set(completed.map((c) => c.lessonId));
  const next = nextLesson(lessons.map((l) => ({ id: l.id, completed: done.has(l.id) })));

  return NextResponse.json(
    { active: true, continueUrl: next ? `/app/learn/${slug}/${next.id}` : "/app" },
    { headers: noStore },
  );
}
