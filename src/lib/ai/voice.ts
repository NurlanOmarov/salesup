import { env } from "@/env";

/**
 * Голосовой слой симулятора через OpenAI Audio API (тот же провайдер, что и
 * эмбеддинги — fetch без SDK). STT: Whisper (речь ученика → текст). TTS: озвучка
 * реплики AI-клиента. ⚠️ Голос ученика уходит на внешний сервис; голос — биометрия
 * (ПДн РК). Включается флагом VOICE_ENABLED (CLAUDE.md, принципы 2 и 9).
 */

const STT_URL = "https://api.openai.com/v1/audio/transcriptions";
const TTS_URL = "https://api.openai.com/v1/audio/speech";

const STT_MODEL = "whisper-1";
const TTS_MODEL = "tts-1";
const TTS_VOICE = "onyx"; // глубокий мужской голос — под роль врача/ЛПР

/** Ограничения, чтобы не отправить лишнего и не словить дорогой запрос. */
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024; // ~8 МБ ≈ несколько минут речи
export const MAX_TTS_CHARS = 600; // реплики клиента короткие

/** OpenAI-ключ для аудио: отдельный, иначе — общий с эмбеддингами (тот же OpenAI). */
function apiKey(): string {
  return env.OPENAI_API_KEY ?? env.EMBEDDINGS_API_KEY;
}

/** Голос включён и есть ключ. */
export function voiceEnabled(): boolean {
  return env.VOICE_ENABLED && !!apiKey();
}

/**
 * Распознать речь ученика (Whisper). Принимает аудио-бинарь и mime-тип, возвращает
 * текст. Подсказка языка — русский (интерфейс RU). Бросает при ошибке API.
 */
export async function transcribeAudio(
  audio: ArrayBuffer | Buffer,
  mime = "audio/webm",
  lang = "ru",
): Promise<string> {
  const bytes = Buffer.isBuffer(audio) ? audio : Buffer.from(new Uint8Array(audio));
  if (bytes.byteLength === 0) throw new Error("Пустое аудио");
  if (bytes.byteLength > MAX_AUDIO_BYTES) throw new Error("Аудио слишком большое");

  const ext = mime.includes("mp4") || mime.includes("m4a") ? "mp4" : mime.includes("mpeg") ? "mp3" : "webm";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), `audio.${ext}`);
  form.append("model", STT_MODEL);
  form.append("language", lang);
  form.append("response_format", "json");

  const res = await fetch(STT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`OpenAI STT ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}

/**
 * Синтезировать речь реплики клиента (OpenAI TTS). Возвращает MP3-аудио (Buffer).
 * Текст обрезается до MAX_TTS_CHARS. Бросает при ошибке API.
 */
export async function synthesizeSpeech(text: string, voice = TTS_VOICE): Promise<Buffer> {
  const input = text.trim().slice(0, MAX_TTS_CHARS);
  if (!input) throw new Error("Пустой текст для озвучки");

  const res = await fetch(TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: TTS_MODEL, voice, input, response_format: "mp3" }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
