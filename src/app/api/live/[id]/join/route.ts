import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { joinUrlFor } from "@/lib/live/service";
import { log } from "@/lib/log";

/**
 * Вход работника на встречу с тренером.
 *
 * Ссылку в кабинет мы не отдаём вовсе — только этот маршрут: он проверяет
 * сессию и членство в организации (`lib/live/service`), а уже потом просит у
 * SABAK персональный доступ. Иначе гостевая ссылка утекла бы в вёрстку и
 * работала бы для любого, кто открыл исходный код страницы.
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
    const url = await joinUrlFor(session.user.id, id);
    if (!url) {
      return new NextResponse("Встреча недоступна", { status: 403 });
    }
    // no-store: ссылка персональная и живёт минуты — кэш промежуточных узлов
    // отдал бы её следующему пользователю.
    return NextResponse.redirect(url, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    log.error({ err: e, sessionId: id }, "live.join: не удалось выдать доступ");
    return new NextResponse("Видеосервис недоступен, попробуйте через минуту", {
      status: 503,
    });
  }
}
