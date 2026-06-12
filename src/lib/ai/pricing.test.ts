import { describe, it, expect } from "vitest";
import { priceFor, costMicroUsd, formatUsd, MODEL_PRICES } from "./pricing.js";

describe("priceFor", () => {
  it("известная модель", () => {
    expect(priceFor("claude-haiku-4-5")).toEqual({ inPerMillion: 1.0, outPerMillion: 5.0 });
  });

  it("неизвестная модель → фоллбэк (как Sonnet)", () => {
    expect(priceFor("gpt-unknown")).toEqual({ inPerMillion: 3.0, outPerMillion: 15.0 });
  });
});

describe("costMicroUsd", () => {
  it("Haiku: 1M in + 1M out = $1 + $5 = $6 = 6_000_000 microUSD", () => {
    expect(costMicroUsd("claude-haiku-4-5", 1_000_000, 1_000_000)).toBe(6_000_000);
  });

  it("Sonnet: 500k in + 100k out", () => {
    // 500000*3 + 100000*15 = 1_500_000 + 1_500_000 = 3_000_000 microUSD = $3
    expect(costMicroUsd("claude-sonnet-4-6", 500_000, 100_000)).toBe(3_000_000);
  });

  it("Voyage embeddings: только вход", () => {
    // 1M * 0.06 = 60_000 microUSD = $0.06
    expect(costMicroUsd("voyage-3", 1_000_000, 0)).toBe(60_000);
  });

  it("малое число токенов округляется", () => {
    // 1234 in * 1.0 + 567 out * 5.0 = 1234 + 2835 = 4069 microUSD
    expect(costMicroUsd("claude-haiku-4-5", 1234, 567)).toBe(4069);
  });

  it("ноль токенов → 0", () => {
    expect(costMicroUsd("claude-haiku-4-5", 0, 0)).toBe(0);
  });
});

describe("formatUsd", () => {
  it("ноль", () => {
    expect(formatUsd(0)).toBe("$0");
  });

  it("очень малая сумма — 4 знака", () => {
    expect(formatUsd(4069)).toBe("$0.0041");
  });

  it("сумма < $1 — 3 знака", () => {
    expect(formatUsd(60_000)).toBe("$0.060");
  });

  it("сумма ≥ $1 — 2 знака", () => {
    expect(formatUsd(6_000_000)).toBe("$6.00");
  });
});

describe("MODEL_PRICES", () => {
  it("содержит модели проекта (Haiku/Sonnet/Voyage)", () => {
    expect(MODEL_PRICES).toHaveProperty("claude-haiku-4-5");
    expect(MODEL_PRICES).toHaveProperty("claude-sonnet-4-6");
    expect(MODEL_PRICES).toHaveProperty("voyage-3");
  });
});
