import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canAccessLesson, httpStatusForDeny } from "@/lib/access";
import { askTutor } from "@/lib/ai/chat";

export const dynamic = "force-dynamic";

const schema = z.object({
  lessonId: z.string().min(1),
  message: z.string().trim().min(2).max(1000),
});

/**
 * AI-наставник (S7.1): вопрос по материалам урока → ответ из RAG-контекста.
 * Доступ через lib/access; лимит и расход — внутри askTutor.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });

  const { lessonId, message } = parsed.data;
  const access = await canAccessLesson(userId, lessonId);
  if (!access.ok) return new NextResponse(access.reason, { status: httpStatusForDeny(access.reason) });

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });
  if (!lesson) return new NextResponse("Not found", { status: 404 });

  try {
    const result = await askTutor(userId, lessonId, lesson.module.courseId, message);
    return NextResponse.json(result);
  } catch (e) {
    console.error("Ошибка AI-наставника:", e);
    return NextResponse.json({ error: "Наставник временно недоступен" }, { status: 503 });
  }
}
