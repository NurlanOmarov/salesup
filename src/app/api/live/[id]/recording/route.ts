import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { recordingUrlFor } from "@/lib/live/service";
import { log } from "@/lib/log";

/**
 * Запись встречи. Постоянной ссылки не существует: маршрут проверяет права и
 * просит у SABAK ссылку на час без права скачивания — запись принадлежит только
 * той компании, для которой прошла встреча (docs/LIVE-SESSIONS-PLAN.md §6).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  // Неавторизованный сюда обычно не доходит — middleware закрывает /api/* и
  // отвечает 401 раньше. Проверка остаётся страховкой на случай изменения
  // matcher: доступ к встрече не должен зависеть от настроек маршрутизации.
  if (!session?.user) return new NextResponse("Требуется вход", { status: 401 });

  try {
    const url = await recordingUrlFor(session.user.id, id);
    if (!url) return new NextResponse("Запись недоступна", { status: 404 });
    return NextResponse.redirect(url, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    log.error({ err: e, sessionId: id }, "live.recording: ссылка не выдана");
    return new NextResponse("Видеосервис недоступен", { status: 503 });
  }
}
