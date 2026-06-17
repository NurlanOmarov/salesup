import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canAccessLesson, httpStatusForDeny } from "@/lib/access";
import { replyAsClient, scoreRun, complianceRulesOf, type SimMessage, type ScenarioRow } from "@/lib/ai/simulate";

export const dynamic = "force-dynamic";

const messageSchema = z.object({
  role: z.enum(["student", "client"]),
  text: z.string().min(1).max(2000),
});

const schema = z.object({
  scenarioId: z.string().min(1),
  history: z.array(messageSchema).max(40),
  finish: z.boolean().optional(),
});

/**
 * Тренажёр-симулятор диалога (S-интерактив): ученик ↔ AI-клиент.
 *  - finish=false → следующая реплика клиента (replyAsClient)
 *  - finish=true  → scorecard по фазам + compliance (scoreRun)
 * Доступ — через lib/access по уроку сценария; лимит — внутри lib/ai/simulate.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });

  const { scenarioId, history, finish } = parsed.data;

  const scenario = await db.simulationScenario.findUnique({
    where: { id: scenarioId },
    select: {
      lessonId: true,
      persona: true,
      objectives: true,
      archetype: true,
      difficulty: true,
      complianceRules: true,
      validation: true,
    },
  });
  if (!scenario || scenario.validation !== "VALIDATED") {
    return new NextResponse("Scenario not found", { status: 404 });
  }

  const access = await canAccessLesson(userId, scenario.lessonId);
  if (!access.ok) return new NextResponse(access.reason, { status: httpStatusForDeny(access.reason) });

  const objectives = Array.isArray(scenario.objectives)
    ? (scenario.objectives.filter((o) => typeof o === "string") as string[])
    : [];
  const scenarioRow: ScenarioRow = {
    persona: scenario.persona,
    objectives,
    archetype: scenario.archetype,
    difficulty: scenario.difficulty,
    complianceRules: complianceRulesOf(scenario.complianceRules),
  };
  const hist = history as SimMessage[];

  try {
    if (finish) {
      const result = await scoreRun(userId, scenarioId, scenarioRow, hist);
      return NextResponse.json(result);
    }
    const result = await replyAsClient(userId, scenarioRow, hist);
    return NextResponse.json(result);
  } catch (e) {
    console.error("Ошибка симулятора:", e);
    return NextResponse.json({ error: "Сервис временно недоступен" }, { status: 503 });
  }
}
