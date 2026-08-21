import { describe, expect, it } from "vitest";
import {
  decryptLabel,
  DEFAULT_KDF,
  encryptLabel,
  fromBase64,
  generateOrgKey,
  generateRecoveryCode,
  normalizeRecoveryCode,
  toBase64,
  unwrapOrgKey,
  validatePassphrase,
  wrapOrgKey,
} from "./crypto";

/**
 * Тесты L2-криптографии. Гоняем на настоящем WebCrypto (Node 20+), а не на
 * моках: смысл проверки именно в том, что данные реально не читаются без ключа.
 *
 * Итерации PBKDF2 в тестах снижены — 600 000 на каждый кейс сделали бы прогон
 * многосекундным, а проверяем мы схему, а не стойкость параметра.
 */
const FAST_KDF = { ...DEFAULT_KDF, iterations: 1_000 };

describe("base64", () => {
  it("туда и обратно без потерь", () => {
    const bytes = Uint8Array.from([0, 1, 127, 128, 255, 42]);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
});

describe("обёртки ключа организации", () => {
  it("ключ разворачивается той же фразой", async () => {
    const orgKey = await generateOrgKey();
    const wrapped = await wrapOrgKey(orgKey, "очень секретная фраза", FAST_KDF);

    const restored = await unwrapOrgKey(wrapped, "очень секретная фраза");
    const blob = await encryptLabel(orgKey, "Иванов И. И.");
    expect(await decryptLabel(restored, blob)).toBe("Иванов И. И.");
  });

  it("неверная фраза не разворачивает ключ, а падает", async () => {
    const orgKey = await generateOrgKey();
    const wrapped = await wrapOrgKey(orgKey, "правильная фраза", FAST_KDF);

    // AES-GCM аутентифицирует данные: неверный ключ даёт ошибку, а не мусор.
    await expect(unwrapOrgKey(wrapped, "неправильная фраза")).rejects.toThrow();
  });

  it("две обёртки одного ключа дают один и тот же ключ", async () => {
    // Так работает второй ответственный представитель и recovery-код.
    const orgKey = await generateOrgKey();
    const adminWrap = await wrapOrgKey(orgKey, "фраза администратора", FAST_KDF);
    const recoveryWrap = await wrapOrgKey(orgKey, "RECOVERYCODE12345", FAST_KDF);

    const blob = await encryptLabel(orgKey, "Пётр Смирнов");
    const viaAdmin = await unwrapOrgKey(adminWrap, "фраза администратора");
    const viaRecovery = await unwrapOrgKey(recoveryWrap, "RECOVERYCODE12345");

    expect(await decryptLabel(viaAdmin, blob)).toBe("Пётр Смирнов");
    expect(await decryptLabel(viaRecovery, blob)).toBe("Пётр Смирнов");
  });

  it("каждая обёртка получает свою соль", async () => {
    const orgKey = await generateOrgKey();
    const a = await wrapOrgKey(orgKey, "одна и та же фраза", FAST_KDF);
    const b = await wrapOrgKey(orgKey, "одна и та же фраза", FAST_KDF);
    expect(a.kdfSalt).not.toBe(b.kdfSalt);
    expect(a.wrappedKey).not.toBe(b.wrappedKey);
  });

  it("параметры KDF едут вместе с обёрткой", async () => {
    const orgKey = await generateOrgKey();
    const wrapped = await wrapOrgKey(orgKey, "фраза для проверки", FAST_KDF);
    expect(wrapped.kdfParams.iterations).toBe(FAST_KDF.iterations);
    // Развернуть можно, ничего не зная о параметрах заранее.
    await expect(unwrapOrgKey(wrapped, "фраза для проверки")).resolves.toBeDefined();
  });
});

describe("метки", () => {
  it("шифрование и расшифровка сохраняют текст, включая кириллицу", async () => {
    const orgKey = await generateOrgKey();
    const blob = await encryptLabel(orgKey, "Иванова Анна, таб. №42");
    expect(blob).not.toBeNull();
    expect(blob).not.toContain("Иванова");
    expect(await decryptLabel(orgKey, blob)).toBe("Иванова Анна, таб. №42");
  });

  it("одинаковый текст даёт разные шифротексты", async () => {
    // Иначе по совпадению blob можно было бы понять, что метки одинаковые.
    const orgKey = await generateOrgKey();
    const a = await encryptLabel(orgKey, "Иванов");
    const b = await encryptLabel(orgKey, "Иванов");
    expect(a).not.toBe(b);
  });

  it("чужой ключ не читает метку — возвращается null, а не исключение", async () => {
    const orgKey = await generateOrgKey();
    const other = await generateOrgKey();
    const blob = await encryptLabel(orgKey, "Секретов С. С.");
    // Список работников не должен падать целиком из-за одной нечитаемой записи.
    expect(await decryptLabel(other, blob)).toBeNull();
  });

  it("пустая метка — это отсутствие метки", async () => {
    const orgKey = await generateOrgKey();
    expect(await encryptLabel(orgKey, "   ")).toBeNull();
    expect(await decryptLabel(orgKey, null)).toBeNull();
  });

  it("битый blob не роняет расшифровку", async () => {
    const orgKey = await generateOrgKey();
    expect(await decryptLabel(orgKey, "не-base64!!")).toBeNull();
  });
});

describe("recovery-код", () => {
  it("формат групп и безопасный алфавит", () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
    for (const ch of "01OIL") expect(code).not.toContain(ch);
  });

  it("коды не повторяются", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateRecoveryCode()));
    expect(codes.size).toBe(50);
  });

  it("при вводе регистр и дефисы не важны", () => {
    expect(normalizeRecoveryCode(" ab2cd-ef3gh ")).toBe("AB2CDEF3GH");
  });
});

describe("validatePassphrase", () => {
  it("отклоняет слишком короткую и чисто цифровую", () => {
    expect(validatePassphrase("аб")).not.toBeNull();
    expect(validatePassphrase("1234567890123")).not.toBeNull();
  });

  it("принимает короткую фразу от трёх символов", () => {
    // Порог снижен сознательно (см. MIN_PASSPHRASE_LENGTH): фразу вводят руками.
    expect(validatePassphrase("абв")).toBeNull();
  });

  it("принимает нормальную фразу", () => {
    expect(validatePassphrase("обучение отдела продаж 2026")).toBeNull();
  });
});
