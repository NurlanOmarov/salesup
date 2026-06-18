import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { transcribeAudio, voiceEnabled, MAX_AUDIO_BYTES } from "@/lib/ai/voice";

export const dynamic = "force-dynamic";

/**
 * STT для голосового симулятора: аудио ученика (multipart `audio`) → текст реплики.
 * Голос — биометрия (ПДн), поэтому только при VOICE_ENABLED и для авторизованных.
 * Доступ к уроку проверяется на шаге диалога (/api/ai/simulate) — здесь лишь распознавание.
 */
export async function POST(req: NextRequest) {
  if (!voiceEnabled()) return new NextResponse("Voice disabled", { status: 404 });

  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "Нет аудио" }, { status: 400 });
  if (file.size === 0 || file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Некорректный размер аудио" }, { status: 400 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const text = await transcribeAudio(buf, file.type || "audio/webm");
    return NextResponse.json({ text });
  } catch (e) {
    console.error("Ошибка STT:", e);
    return NextResponse.json({ error: "Не удалось распознать речь" }, { status: 503 });
  }
}
