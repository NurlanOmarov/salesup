import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { synthesizeSpeech, voiceEnabled, MAX_TTS_CHARS } from "@/lib/ai/voice";

export const dynamic = "force-dynamic";

const schema = z.object({ text: z.string().min(1).max(MAX_TTS_CHARS) });

/**
 * TTS для голосового симулятора: текст реплики AI-клиента → MP3-озвучка.
 * Только при VOICE_ENABLED и для авторизованных. Текст уже получен из /api/ai/simulate
 * (с проверкой доступа), здесь — только синтез речи.
 */
export async function POST(req: NextRequest) {
  if (!voiceEnabled()) return new NextResponse("Voice disabled", { status: 404 });

  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });

  try {
    const mp3 = await synthesizeSpeech(parsed.data.text);
    return new NextResponse(new Uint8Array(mp3), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("Ошибка TTS:", e);
    return NextResponse.json({ error: "Не удалось озвучить" }, { status: 503 });
  }
}
