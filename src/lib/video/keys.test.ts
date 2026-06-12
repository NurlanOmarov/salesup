import { describe, it, expect } from "vitest";
import {
  generateHlsKey,
  encryptHlsKey,
  decryptHlsKey,
} from "./keys.js";

const SECRET = "test-video-key-enc-secret-0123456789";

describe("HLS key crypto", () => {
  it("generateHlsKey возвращает ровно 16 байт (AES-128)", () => {
    expect(generateHlsKey().length).toBe(16);
  });

  it("два сгенерированных ключа различаются", () => {
    expect(generateHlsKey().equals(generateHlsKey())).toBe(false);
  });

  it("encrypt → decrypt восстанавливает исходный ключ", () => {
    const key = generateHlsKey();
    const enc = encryptHlsKey(key, SECRET);
    const dec = decryptHlsKey(enc, SECRET);
    expect(dec.equals(key)).toBe(true);
  });

  it("шифртекст не равен открытому ключу и является base64", () => {
    const key = generateHlsKey();
    const enc = encryptHlsKey(key, SECRET);
    expect(enc).not.toContain(key.toString("base64"));
    expect(() => Buffer.from(enc, "base64")).not.toThrow();
  });

  it("каждое шифрование даёт разный результат (случайный IV)", () => {
    const key = generateHlsKey();
    expect(encryptHlsKey(key, SECRET)).not.toBe(encryptHlsKey(key, SECRET));
  });

  it("неверный секрет → ошибка аутентификации (GCM)", () => {
    const enc = encryptHlsKey(generateHlsKey(), SECRET);
    expect(() => decryptHlsKey(enc, "wrong-secret-wrong-secret-123456")).toThrow();
  });

  it("подделка шифртекста → ошибка", () => {
    const enc = encryptHlsKey(generateHlsKey(), SECRET);
    const buf = Buffer.from(enc, "base64");
    buf[buf.length - 1] = (buf[buf.length - 1] ?? 0) ^ 0xff; // портим последний байт
    expect(() => decryptHlsKey(buf.toString("base64"), SECRET)).toThrow();
  });

  it("отказ шифровать ключ неверной длины", () => {
    expect(() => encryptHlsKey(Buffer.alloc(8), SECRET)).toThrow(/16 байт/);
  });

  it("слишком короткое хранимое значение → ошибка", () => {
    expect(() => decryptHlsKey(Buffer.alloc(4).toString("base64"), SECRET)).toThrow(
      /Повреждённое/,
    );
  });
});
