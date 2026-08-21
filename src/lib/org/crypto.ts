/**
 * L2: шифрование меток работников на стороне клиента (docs/B2B-PLAN.md §5.2).
 *
 * Задача — сделать так, чтобы соответствие «код ↔ конкретный человек» было
 * недоступно платформе даже при полном доступе к базе. Поэтому:
 *
 *  • ключ организации (`orgKey`, AES-256-GCM) генерируется в браузере и НИКОГДА
 *    не отправляется на сервер;
 *  • на сервере лежат только его обёртки (`OrgKeyWrap`): копии orgKey,
 *    зашифрованные под ключом, выведенным из парольной фразы конкретного
 *    ответственного представителя, и под recovery-кодом;
 *  • метка сотрудника (`OrgMembership.labelEnc`) — непрозрачный blob.
 *
 * Почему не выводим ключ шифрования прямо из фразы: тогда смена фразы означала
 * бы перешифровку всех меток, а второй ответственный был бы невозможен. Обёртки
 * решают обе задачи — ключ один, обёрток сколько угодно.
 *
 * Модуль сознательно не зависит от React и DOM: работает и в браузере, и в
 * тестах на node:crypto.webcrypto (crypto.test.ts).
 */

/** Параметры вывода ключа из парольной фразы. Хранятся рядом с каждой обёрткой,
 *  чтобы поднять стойкость позже, не трогая уже выпущенные записи. */
export interface KdfParams {
  alg: "PBKDF2";
  hash: "SHA-256";
  iterations: number;
}

export const DEFAULT_KDF: KdfParams = {
  alg: "PBKDF2",
  hash: "SHA-256",
  iterations: 600_000,
};

const IV_BYTES = 12; // рекомендованная длина nonce для AES-GCM
const SALT_BYTES = 16;

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new Error("WebCrypto недоступен: нужен браузер или Node 20+");
  }
  return c.subtle;
}

// ─────────────────────────── base64 ───────────────────────────

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  // btoa есть и в браузере, и в Node 16+
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

// ─────────────────────────── Ключи ───────────────────────────

/** Новый ключ организации. Extractable — иначе его нельзя обернуть под фразу. */
export async function generateOrgKey(): Promise<CryptoKey> {
  return subtle().generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

/** Ключ шифрования ключа (KEK) из парольной фразы или recovery-кода. */
export async function deriveKek(
  passphrase: string,
  salt: Uint8Array,
  params: KdfParams = DEFAULT_KDF,
): Promise<CryptoKey> {
  const material = await subtle().importKey(
    "raw",
    new TextEncoder().encode(passphrase.normalize("NFKC")),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle().deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: params.iterations,
      hash: params.hash,
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface WrappedKey {
  wrappedKey: string;
  kdfSalt: string;
  kdfParams: KdfParams;
}

/** Обернуть ключ организации под парольную фразу (или recovery-код). */
export async function wrapOrgKey(
  orgKey: CryptoKey,
  passphrase: string,
  params: KdfParams = DEFAULT_KDF,
): Promise<WrappedKey> {
  const salt = randomBytes(SALT_BYTES);
  const kek = await deriveKek(passphrase, salt, params);
  const raw = new Uint8Array(await subtle().exportKey("raw", orgKey));
  const iv = randomBytes(IV_BYTES);
  const ciphertext = new Uint8Array(
    await subtle().encrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource },
      kek,
      raw as unknown as BufferSource,
    ),
  );

  const blob = new Uint8Array(iv.length + ciphertext.length);
  blob.set(iv, 0);
  blob.set(ciphertext, iv.length);

  return {
    wrappedKey: toBase64(blob),
    kdfSalt: toBase64(salt),
    kdfParams: params,
  };
}

/**
 * Развернуть ключ организации. Неверная фраза даёт ошибку аутентификации
 * AES-GCM, а не «мусорный ключ» — поэтому проверять фразу отдельно не нужно.
 */
export async function unwrapOrgKey(
  wrapped: WrappedKey,
  passphrase: string,
): Promise<CryptoKey> {
  const salt = fromBase64(wrapped.kdfSalt);
  const kek = await deriveKek(passphrase, salt, wrapped.kdfParams);
  const blob = fromBase64(wrapped.wrappedKey);
  const iv = blob.slice(0, IV_BYTES);
  const ciphertext = blob.slice(IV_BYTES);

  const raw = await subtle().decrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    kek,
    ciphertext as unknown as BufferSource,
  );

  return subtle().importKey("raw", raw, { name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

// ─────────────────────────── Метки ───────────────────────────

/** Зашифровать метку сотрудника. Пустая строка — это «метки нет» (null). */
export async function encryptLabel(
  orgKey: CryptoKey,
  text: string,
): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const iv = randomBytes(IV_BYTES);
  const ciphertext = new Uint8Array(
    await subtle().encrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource },
      orgKey,
      new TextEncoder().encode(trimmed) as unknown as BufferSource,
    ),
  );
  const blob = new Uint8Array(iv.length + ciphertext.length);
  blob.set(iv, 0);
  blob.set(ciphertext, iv.length);
  return toBase64(blob);
}

/**
 * Расшифровать метку. Возвращает null, если blob не читается этим ключом —
 * так список работников не падает целиком из-за одной битой записи (например,
 * оставшейся от прежнего ключа организации).
 */
export async function decryptLabel(
  orgKey: CryptoKey,
  blob: string | null,
): Promise<string | null> {
  if (!blob) return null;
  try {
    const bytes = fromBase64(blob);
    const iv = bytes.slice(0, IV_BYTES);
    const ciphertext = bytes.slice(IV_BYTES);
    const plain = await subtle().decrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource },
      orgKey,
      ciphertext as unknown as BufferSource,
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

// ─────────────────────────── Recovery-код ───────────────────────────

/** Алфавит без похожих символов: код переписывают с бумаги. */
const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const RECOVERY_GROUPS = 4;
const RECOVERY_GROUP_LEN = 5;

/**
 * Код восстановления вида `AB2CD-EF3GH-...`. Единственный способ вернуть метки,
 * если ответственный забыл парольную фразу, поэтому показывается один раз и
 * хранится клиентом вне платформы.
 */
export function generateRecoveryCode(): string {
  const bytes = randomBytes(RECOVERY_GROUPS * RECOVERY_GROUP_LEN);
  const chars = [...bytes].map((b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]);
  const groups: string[] = [];
  for (let i = 0; i < RECOVERY_GROUPS; i += 1) {
    groups.push(chars.slice(i * RECOVERY_GROUP_LEN, (i + 1) * RECOVERY_GROUP_LEN).join(""));
  }
  return groups.join("-");
}

/** Регистр и дефисы при вводе не важны. */
export function normalizeRecoveryCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Ниже этой длины фраза не принимается. */
export const MIN_PASSPHRASE_LENGTH = 3;

/**
 * Минимальные требования к парольной фразе: её вводят руками и нечасто.
 *
 * Порог низкий по решению владельца — короткую фразу проще держать в голове.
 * Стойкость при этом опирается на PBKDF2 с 600 000 итераций и на то, что
 * подобрать её можно только имея на руках выгрузку OrgKeyWrap, а не через
 * публичный эндпоинт; длинная фраза всё равно надёжнее, о чём говорит форма.
 */
export function validatePassphrase(value: string): string | null {
  const v = value.trim();
  if (v.length < MIN_PASSPHRASE_LENGTH) {
    return `Фраза должна быть не короче ${MIN_PASSPHRASE_LENGTH} символов`;
  }
  if (!/[^\d]/.test(v)) return "Добавьте буквы, а не только цифры";
  return null;
}
