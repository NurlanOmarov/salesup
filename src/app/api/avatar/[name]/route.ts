import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Отдаёт GLB-аватар говорящей головы из media/avatars/. Не секрет, но раздаём
 * только авторизованным (используется лишь внутри кабинета). Имя из белого списка —
 * никаких произвольных ключей в хранилище.
 */
const ALLOWED = new Set(["doctor"]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { name } = await params;
  if (!ALLOWED.has(name)) return new NextResponse("Not found", { status: 404 });

  try {
    const data = await storage.get(`avatars/${name}.glb`);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "model/gltf-binary",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
