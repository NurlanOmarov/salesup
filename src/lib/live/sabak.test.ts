import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Тесты клиента SABAK. Сеть подменяется целиком: проверяем не чужой сервис, а
 * наш контракт с ним — что уходит в запросе, как ведём себя на 401 и, главное,
 * что наружу не утекают персональные данные работника.
 */

const envMock = {
  LIVE_SESSIONS_ENABLED: true,
  SABAK_BASE_URL: "https://api.sabak.test/api/v1",
  SABAK_CLIENT_ID: "cid",
  SABAK_CLIENT_SECRET: "secret",
  SABAK_SERVICE_LOGIN: undefined as string | undefined,
  SABAK_SERVICE_PASSWORD: undefined as string | undefined,
};

vi.mock("@/env", () => ({ env: envMock }));
vi.mock("@/lib/log", () => ({
  log: { warn: () => undefined, error: () => undefined, info: () => undefined },
}));

const { createSession, guestAccess, liveEnabled, resetTokenCache, SabakError } =
  await import("./sabak");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetTokenCache();
  envMock.LIVE_SESSIONS_ENABLED = true;
  envMock.SABAK_CLIENT_ID = "cid";
  envMock.SABAK_CLIENT_SECRET = "secret";
  envMock.SABAK_SERVICE_LOGIN = undefined;
  envMock.SABAK_SERVICE_PASSWORD = undefined;
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Токен выдаём один раз, дальше отвечает переданный обработчик. */
function withToken(handler: (url: string, init: RequestInit) => Response) {
  fetchMock.mockImplementation((url: string, init: RequestInit) => {
    if (url.endsWith("/oauth/token")) {
      return Promise.resolve(
        jsonResponse({ access_token: "tok-1", expires_in: 900 }),
      );
    }
    return Promise.resolve(handler(url, init));
  });
}

describe("готовность интеграции", () => {
  it("выключена без флага", () => {
    envMock.LIVE_SESSIONS_ENABLED = false;
    expect(liveEnabled()).toBe(false);
  });

  it("выключена, если нет ни ключа, ни учётки тренера", () => {
    envMock.SABAK_CLIENT_ID = undefined as unknown as string;
    envMock.SABAK_CLIENT_SECRET = undefined as unknown as string;
    expect(liveEnabled()).toBe(false);
  });

  it("работает на временной учётке тренера, пока нет ключей", () => {
    envMock.SABAK_CLIENT_ID = undefined as unknown as string;
    envMock.SABAK_CLIENT_SECRET = undefined as unknown as string;
    envMock.SABAK_SERVICE_LOGIN = "trainer";
    envMock.SABAK_SERVICE_PASSWORD = "pass";
    expect(liveEnabled()).toBe(true);
  });
});

describe("создание встречи", () => {
  it("шлёт ключ идемпотентности — иначе повтор задвоит встречу в календаре", async () => {
    let seen: RequestInit | null = null;
    withToken((_url, init) => {
      seen = init;
      return jsonResponse({ id: "les-1", guestUrl: "https://s/m/les-1", status: "SCHEDULED" });
    });

    const res = await createSession({
      title: "Вводная",
      scheduledAt: new Date("2026-09-10T11:00:00.000Z"),
      durationMin: 60,
      kind: "WEBINAR",
      groupName: "Ромашка — отдел продаж",
      idempotencyKey: "key-42",
    });

    expect(res.id).toBe("les-1");
    const headers = (seen as unknown as RequestInit).headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("key-42");
    expect(headers.authorization).toBe("Bearer tok-1");
  });

  it("анкету гостя не включает: это был бы сбор ПДн работника", async () => {
    let body: Record<string, unknown> = {};
    withToken((_url, init) => {
      body = JSON.parse(String(init.body));
      return jsonResponse({ id: "les-1", guestUrl: "u", status: "SCHEDULED" });
    });

    await createSession({
      title: "Вводная",
      scheduledAt: new Date(),
      durationMin: 60,
      kind: "WEBINAR",
      groupName: "g",
      idempotencyKey: "k",
    });

    expect(body.guestRequireFullName).toBe(false);
    expect(body.guestRequirePosition).toBe(false);
    expect(body.guestRequireContact).toBe(false);
    expect(body.allowGuests).toBe(true);
  });

  it("токен берётся из кеша: второй вызов не логинится заново", async () => {
    withToken(() => jsonResponse({ id: "x", guestUrl: "u", status: "SCHEDULED" }));
    const input = {
      title: "t",
      scheduledAt: new Date(),
      durationMin: 60,
      kind: "WEBINAR" as const,
      groupName: "g",
      idempotencyKey: "k",
    };
    await createSession(input);
    await createSession(input);

    const tokenCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).endsWith("/oauth/token"),
    );
    expect(tokenCalls).toHaveLength(1);
  });

  it("на 401 перелогинивается и повторяет запрос ровно один раз", async () => {
    let attempts = 0;
    fetchMock.mockImplementation((url: string) => {
      if (String(url).endsWith("/oauth/token")) {
        return Promise.resolve(jsonResponse({ access_token: "tok", expires_in: 900 }));
      }
      attempts += 1;
      return Promise.resolve(
        attempts === 1
          ? jsonResponse({ message: "нет" }, 401)
          : jsonResponse({ id: "les-2", guestUrl: "u", status: "SCHEDULED" }),
      );
    });

    const res = await createSession({
      title: "t",
      scheduledAt: new Date(),
      durationMin: 60,
      kind: "MEETING",
      groupName: "g",
      idempotencyKey: "k",
    });

    expect(res.id).toBe("les-2");
    expect(attempts).toBe(2);
  });

  it("ошибку сервиса отдаёт наверх со статусом, а не глотает", async () => {
    withToken(() => jsonResponse({ message: "тариф не позволяет" }, 403));
    await expect(
      createSession({
        title: "t",
        scheduledAt: new Date(),
        durationMin: 60,
        kind: "MEETING",
        groupName: "g",
        idempotencyKey: "k",
      }),
    ).rejects.toMatchObject({ name: "SabakError", status: 403 });
    expect(SabakError).toBeTruthy();
  });
});

describe("гостевой доступ", () => {
  it("наружу уходит только обезличенный логин", async () => {
    let body: Record<string, unknown> = {};
    withToken((_url, init) => {
      body = JSON.parse(String(init.body));
      return jsonResponse({ joinUrl: "https://s/m/x?t=1", expiresAt: "2026-09-10T11:00:00Z" });
    });

    const res = await guestAccess("les-1", "acme-0042");

    expect(res.joinUrl).toContain("https://");
    expect(body).toEqual({ externalId: "acme-0042", displayName: "acme-0042" });
    // Ни одного поля с персональными данными в запросе быть не должно.
    expect(Object.keys(body)).not.toContain("email");
    expect(Object.keys(body)).not.toContain("fullName");
    expect(Object.keys(body)).not.toContain("phone");
  });
});
