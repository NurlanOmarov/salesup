import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * Шифрование 16-байтового AES-128 ключа HLS перед хранением в БД
 * (Lesson.videoAesKeyEnc) и расшифровка при выдаче через защищённый эндпоинт
 * `/api/video/key/<lessonId>` (CLAUDE.md, правило 2 и Env: VIDEO_KEY_ENC_SECRET).
 *
 * Сам ключ НИКОГДА не лежит на диске VPS в открытом виде и не попадает в плейлист —
 * в m3u8 указывается только URI эндпоинта. Обёртка: AES-256-GCM, ключ обёртки
 * выводится из секрета приложения через SHA-256. Формат шранимого значения:
 *   base64( iv(12) ‖ authTag(16) ‖ ciphertext(16) )
 */

const HLS_KEY_BYTES = 16; // AES-128
const IV_BYTES = 12; // GCM nonce
const TAG_BYTES = 16;

/** 32-байтовый ключ обёртки из секрета приложения (детерминированно). */
function wrappingKey(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

/** Сгенерировать случайный 16-байтовый AES-128 ключ для HLS. */
export function generateHlsKey(): Buffer {
  return randomBytes(HLS_KEY_BYTES);
}

/** Зашифровать HLS-ключ секретом приложения → строка для БД. */
export function encryptHlsKey(key: Buffer, secret: string): string {
  if (key.length !== HLS_KEY_BYTES) {
    throw new Error(`HLS-ключ должен быть ${HLS_KEY_BYTES} байт, получено ${key.length}`);
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", wrappingKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(key), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

/** Расшифровать HLS-ключ из БД. Бросает при подделке (GCM auth) или неверном секрете. */
export function decryptHlsKey(stored: string, secret: string): Buffer {
  const buf = Buffer.from(stored, "base64");
  if (buf.length < IV_BYTES + TAG_BYTES + HLS_KEY_BYTES) {
    throw new Error("Повреждённое значение зашифрованного HLS-ключа");
  }
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", wrappingKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
