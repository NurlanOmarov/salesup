import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getDueCards, gradeCard, seedReviewsForUser, dueCount } from "@/lib/learn/review";

export const dynamic = "force-dynamic";

/**
 * Тренажёр интервального повторения карточек.
 *  - GET  → засеять недостающие карточки доступных курсов + вернуть карточки к повторению
 *  - POST → записать результат ответа и пересчитать срок (gradeCard)
 * Доступ ограничен активными enrollment внутри lib/learn/review. LLM не используется.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  await seedReviewsForUser(userId);
  const due = await getDueCards(userId);
  const remaining = await dueCount(userId);
  return NextResponse.json({ due, remaining });
}

const gradeSchema = z.object({
  artifactId: z.string().min(1),
  cardIndex: z.number().int().min(0),
  remembered: z.boolean(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const parsed = gradeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });

  const { artifactId, cardIndex, remembered } = parsed.data;
  const result = await gradeCard(userId, artifactId, cardIndex, remembered);
  if (!result) return new NextResponse("Card not found", { status: 404 });

  const remaining = await dueCount(userId);
  return NextResponse.json({ ...result, remaining });
}
