import { describe, it, expect, vi } from "vitest";

// recordLlmUsage пишет в БД — в unit-тесте мокаем, чтобы не дёргать Prisma.
vi.mock("./usage.js", () => ({ recordLlmUsage: async () => undefined }));

import { embedQuery, embedDocuments, toVectorLiteral } from "./embeddings.js";

describe("embedQuery", () => {
  it("возвращает вектор из ответа Voyage", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }], usage: { total_tokens: 5 } }),
    })) as unknown as typeof fetch;
    expect(await embedQuery("привет")).toEqual([0.1, 0.2, 0.3]);
  });

  it("возвращает null при ошибке Voyage (graceful degradation)", async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 429, text: async () => "rate limit" })) as unknown as typeof fetch;
    expect(await embedQuery("привет")).toBeNull();
  });

  it("на пустой запрос не ходит в сеть", async () => {
    const f = vi.fn();
    global.fetch = f as unknown as typeof fetch;
    expect(await embedQuery("   ")).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});

describe("embedDocuments", () => {
  it("батчит запросы и сохраняет порядок векторов", async () => {
    const batchSizes: number[] = [];
    global.fetch = vi.fn(async (_url, init) => {
      const body = JSON.parse((init as RequestInit).body as string) as { input: string[] };
      batchSizes.push(body.input.length);
      // эмбеддинг = [длина текста], индекс в пределах батча
      const data = body.input.map((t, i) => ({ index: i, embedding: [t.length] }));
      return { ok: true, json: async () => ({ data, usage: { total_tokens: 1 } }) };
    }) as unknown as typeof fetch;

    const texts = Array.from({ length: 70 }, (_, i) => "x".repeat(i + 1));
    const vecs = await embedDocuments(texts, 32);

    expect(vecs).toHaveLength(70);
    expect(batchSizes).toEqual([32, 32, 6]);
    expect(vecs[0]).toEqual([1]); // первый текст длиной 1
    expect(vecs[69]).toEqual([70]); // последний — длиной 70
  });
});

describe("toVectorLiteral", () => {
  it("сериализует в литерал pgvector", () => {
    expect(toVectorLiteral([0.1, 0.2, 0.3])).toBe("[0.1,0.2,0.3]");
  });
});
