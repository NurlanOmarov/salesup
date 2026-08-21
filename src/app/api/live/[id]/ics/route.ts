import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildIcs } from "@/lib/live/format";

/**
 * Календарный файл встречи. Заменяет письмо-приглашение: e-mail работника
 * платформа не знает и знать не должна, а .ics открывается любым календарём.
 *
 * Внутрь кладём ссылку на наш маршрут входа, а не гостевую ссылку SABAK: файл
 * могут переслать, и доступ всё равно обязан проходить проверку прав.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return new NextResponse("Требуется вход", { status: 401 });

  const live = await db.liveSession.findUnique({
    where: { id },
    select: {
      id: true,
      orgId: true,
      title: true,
      scheduledAt: true,
      durationMin: true,
      status: true,
    },
  });
  if (!live || live.status === "CANCELLED") {
    return new NextResponse("Встреча не найдена", { status: 404 });
  }

  const allowed =
    session.user.role === "OWNER" ||
    !!(await db.orgMembership.findFirst({
      where: { userId: session.user.id, orgId: live.orgId, isActive: true },
      select: { id: true },
    }));
  if (!allowed) return new NextResponse("Нет доступа", { status: 403 });

  const origin = new URL(req.url).origin;
  const ics = buildIcs({
    id: live.id,
    title: live.title,
    scheduledAt: live.scheduledAt,
    durationMin: live.durationMin,
    joinUrl: `${origin}/api/live/${live.id}/join`,
  });

  return new NextResponse(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="session-${live.id}.ics"`,
      "cache-control": "no-store",
    },
  });
}
