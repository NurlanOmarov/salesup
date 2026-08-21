import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/log", () => ({
  log: { warn: () => undefined, error: () => undefined, info: () => undefined },
}));

const { verifySignature } = await import("./webhook");

/**
 * Подпись вебхука — единственное, что отличает событие от SABAK от запроса
 * любого, кто узнал наш URL. Поэтому проверяем её отдельно и придирчиво.
 */

const SECRET = "whsec_test";
const BODY = JSON.stringify({ id: "d1", event: "lesson.started", data: { lessonId: "l1" } });

function sign(body: string, ts: number, secret = SECRET): string {
  return createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
}

function headers(ts: number, signature: string) {
  return {
    event: "lesson.started",
    delivery: "d1",
    timestamp: String(ts),
    signature,
  };
}

const now = new Date("2026-09-10T12:00:00.000Z");
const nowSec = Math.floor(now.getTime() / 1000);

describe("подпись вебхука SABAK", () => {
  it("принимает корректно подписанное событие", () => {
    const res = verifySignature(BODY, headers(nowSec, sign(BODY, nowSec)), SECRET, now);
    expect(res.ok).toBe(true);
  });

  it("отвергает чужую подпись", () => {
    const res = verifySignature(
      BODY,
      headers(nowSec, sign(BODY, nowSec, "другой-секрет")),
      SECRET,
      now,
    );
    expect(res).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("отвергает подделанное тело при верной подписи от другого тела", () => {
    const signature = sign(BODY, nowSec);
    const tampered = JSON.stringify({ id: "d1", event: "lesson.finished", data: {} });
    expect(verifySignature(tampered, headers(nowSec, signature), SECRET, now).ok).toBe(
      false,
    );
  });

  it("подмена timestamp ломает подпись — он входит в подписываемые данные", () => {
    const signature = sign(BODY, nowSec);
    const res = verifySignature(BODY, headers(nowSec - 10, signature), SECRET, now);
    expect(res).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("не принимает событие старше пяти минут (защита от повтора перехвата)", () => {
    const old = nowSec - 400;
    const res = verifySignature(BODY, headers(old, sign(BODY, old)), SECRET, now);
    expect(res).toEqual({ ok: false, reason: "stale" });
  });

  it("принимает событие из будущего в пределах окна — часы отправителя могут спешить", () => {
    const ahead = nowSec + 120;
    const res = verifySignature(BODY, headers(ahead, sign(BODY, ahead)), SECRET, now);
    expect(res.ok).toBe(true);
  });

  it("без секрета приём выключен, а не открыт", () => {
    const res = verifySignature(BODY, headers(nowSec, sign(BODY, nowSec)), undefined, now);
    expect(res).toEqual({ ok: false, reason: "no_secret" });
  });

  it("без заголовков отказывает, не падая", () => {
    const res = verifySignature(
      BODY,
      { event: null, delivery: null, timestamp: null, signature: null },
      SECRET,
      now,
    );
    expect(res).toEqual({ ok: false, reason: "missing_headers" });
  });

  it("нечисловой timestamp не проходит", () => {
    const res = verifySignature(
      BODY,
      { ...headers(nowSec, sign(BODY, nowSec)), timestamp: "позавчера" },
      SECRET,
      now,
    );
    expect(res).toEqual({ ok: false, reason: "missing_headers" });
  });

  it("подпись в верхнем регистре принимается — hex есть hex", () => {
    const signature = sign(BODY, nowSec).toUpperCase();
    expect(verifySignature(BODY, headers(nowSec, signature), SECRET, now).ok).toBe(true);
  });

  it("подпись обрезанной длины отвергается без исключения", () => {
    const signature = sign(BODY, nowSec).slice(0, 10);
    expect(verifySignature(BODY, headers(nowSec, signature), SECRET, now)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });
});
