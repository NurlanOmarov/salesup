import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  alfaChecksum,
  checksumSource,
  checksumVariants,
  verifyAlfaCallback,
  verifyAlfaChecksum,
} from "./checksum.js";
import {
  alfaCallbackSchema,
  alfaEventId,
  outcomeOf,
  paramsFromBody,
  paramsFromSearch,
} from "./callback.js";
import { matchCourseFromText } from "./course.js";
import { alfaPaymentUrlSchema, isAlfaPaymentUrl } from "./link.js";

const TOKEN = "alfa-callback-token";

/** Уведомление в том виде, в каком его шлёт шлюз (порядок параметров произвольный). */
const notification: Record<string, string> = {
  amount: "100",
  mdOrder: "3ff6962a-7dcc-4283-ab50-a6d7dd3386fe",
  operation: "deposited",
  orderNumber: "10747",
  status: "1",
};

describe("контрольная сумма", () => {
  it("собирает строку по алфавиту и закрывает её точкой с запятой", () => {
    expect(checksumSource(notification)).toBe(
      "amount;100;mdOrder;3ff6962a-7dcc-4283-ab50-a6d7dd3386fe;operation;deposited;orderNumber;10747;status;1;",
    );
  });

  it("не включает в строку сам checksum и sign_alias", () => {
    const source = checksumSource({ ...notification, checksum: "ABC", sign_alias: "key1" });
    expect(source).toBe(checksumSource(notification));
  });

  it("считает HMAC-SHA256 в верхнем регистре — как шлюз", () => {
    const expected = createHmac("sha256", TOKEN)
      .update(checksumSource(notification), "utf8")
      .digest("hex")
      .toUpperCase();
    expect(alfaChecksum(notification, TOKEN)).toBe(expected);
  });

  it("принимает подлинное уведомление независимо от регистра подписи", () => {
    const checksum = alfaChecksum(notification, TOKEN);
    expect(verifyAlfaChecksum({ ...notification, checksum }, TOKEN)).toBe(true);
    expect(verifyAlfaChecksum({ ...notification, checksum: checksum.toLowerCase() }, TOKEN)).toBe(true);
  });

  it("отклоняет подделку: чужой токен, подмена суммы, отсутствие подписи", () => {
    const checksum = alfaChecksum(notification, TOKEN);
    expect(verifyAlfaChecksum({ ...notification, checksum }, "другой-токен")).toBe(false);
    // подменили сумму, подпись осталась старой
    expect(verifyAlfaChecksum({ ...notification, amount: "1", checksum }, TOKEN)).toBe(false);
    expect(verifyAlfaChecksum(notification, TOKEN)).toBe(false);
    expect(verifyAlfaChecksum({ ...notification, checksum: "" }, TOKEN)).toBe(false);
  });

  it("не падает на подписи другой длины", () => {
    expect(verifyAlfaChecksum({ ...notification, checksum: "КОРОТКО" }, TOKEN)).toBe(false);
  });
});

describe("трактовка события", () => {
  it("доступ открывает только списание средств", () => {
    expect(outcomeOf("deposited", "1")).toBe("paid");
    expect(outcomeOf("DEPOSITED", "1")).toBe("paid");
  });

  it("холдирование доступ не открывает — денег ещё нет", () => {
    expect(outcomeOf("approved", "1")).toBe("ignore");
  });

  it("возврат и отмена отзывают доступ", () => {
    expect(outcomeOf("refunded", "1")).toBe("revoked");
    expect(outcomeOf("reversed", "1")).toBe("revoked");
  });

  it("неуспешные операции игнорируются", () => {
    expect(outcomeOf("deposited", "0")).toBe("ignore");
    expect(outcomeOf("refunded", "0")).toBe("ignore");
    expect(outcomeOf("declinedByTimeout", "1")).toBe("ignore");
  });
});

describe("ключ идемпотентности", () => {
  it("одинаков для повторной доставки и различает события заказа", () => {
    const base = alfaCallbackSchema.parse({ ...notification });
    const same = alfaCallbackSchema.parse({ ...notification, amount: "100" });
    expect(alfaEventId(base)).toBe(alfaEventId(same));

    const refund = alfaCallbackSchema.parse({ ...notification, operation: "refunded" });
    expect(alfaEventId(refund)).not.toBe(alfaEventId(base));

    const failed = alfaCallbackSchema.parse({ ...notification, status: "0" });
    expect(alfaEventId(failed)).not.toBe(alfaEventId(base));
  });
});

describe("разбор параметров", () => {
  it("читает уведомление из query (GET)", () => {
    const params = paramsFromSearch(
      new URLSearchParams("mdOrder=abc&operation=deposited&status=1&checksum=AA"),
    );
    expect(params).toEqual({ mdOrder: "abc", operation: "deposited", status: "1", checksum: "AA" });
  });

  it("читает тело POST в формате формы", () => {
    expect(paramsFromBody("mdOrder=abc&operation=deposited&status=1")).toEqual({
      mdOrder: "abc",
      operation: "deposited",
      status: "1",
    });
  });

  it("читает тело POST в формате JSON и приводит значения к строкам", () => {
    expect(paramsFromBody('{"mdOrder":"abc","status":1}')).toEqual({
      mdOrder: "abc",
      status: "1",
    });
  });

  it("не падает на пустом и битом теле", () => {
    expect(paramsFromBody("")).toEqual({});
    expect(paramsFromBody("{битый json")).toEqual({});
  });

  it("схема требует минимум: заказ, операцию и статус", () => {
    expect(alfaCallbackSchema.safeParse(notification).success).toBe(true);
    expect(alfaCallbackSchema.safeParse({ operation: "deposited", status: "1" }).success).toBe(false);
  });

  it("принимает e-mail и course, когда шлюз их присылает", () => {
    const parsed = alfaCallbackSchema.parse({
      ...notification,
      email: "buyer@example.by",
      course: "sales-spin",
    });
    expect(parsed.email).toBe("buyer@example.by");
    expect(parsed.course).toBe("sales-spin");
  });
});

describe("определение курса по тексту заказа", () => {
  const courses = [
    { slug: "sales-spin", title: "СПИН-продажи: как формировать потребность" },
    { slug: "sales-kitchens", title: "Эффективные продажи кухонь 2.0" },
    { slug: "time-management", title: "Тайм менеджмент: базовые принципы" },
  ];

  it("узнаёт курс по адресу, вписанному в описание ссылки", () => {
    const text = "Онлайн-курс, доступ на 12 месяцев. Код курса: sales-spin";
    expect(matchCourseFromText([text], courses)?.slug).toBe("sales-spin");
  });

  it("узнаёт курс по названию, если адреса в тексте нет", () => {
    expect(
      matchCourseFromText([null, "СПИН-продажи: как формировать потребность"], courses)?.slug,
    ).toBe("sales-spin");
  });

  it("сравнивает названия без учёта регистра и пунктуации", () => {
    expect(matchCourseFromText(["эффективные продажи кухонь 2 0"], courses)?.slug).toBe(
      "sales-kitchens",
    );
  });

  it("адрес курса важнее названия: они могут указывать на разное", () => {
    const text = "Эффективные продажи кухонь 2.0 (код: sales-spin)";
    expect(matchCourseFromText([text], courses)?.slug).toBe("sales-spin");
  });

  it("не путает адрес курса с частью другого слова", () => {
    expect(matchCourseFromText(["курс sales-spinner для менеджеров"], courses)).toBeNull();
  });

  it("на заказе магазина, где курса нет, возвращает null", () => {
    expect(matchCourseFromText(["Заказ №30412 в интернет-магазине"], courses)).toBeNull();
    expect(matchCourseFromText([null, undefined, "  "], courses)).toBeNull();
  });
});

describe("e-mail покупателя", () => {
  it("читается из payerEmail — так его присылает шлюз", () => {
    const parsed = alfaCallbackSchema.parse({ ...notification, payerEmail: "Buyer@Example.by" });
    expect(parsed.payerEmail).toBe("Buyer@Example.by");
  });

  it("описание и название заказа попадают в разбор", () => {
    const parsed = alfaCallbackSchema.parse({
      ...notification,
      orderDescription: "Код курса: sales-spin",
      name: "СПИН-продажи",
    });
    expect(parsed.orderDescription).toContain("sales-spin");
    expect(parsed.name).toBe("СПИН-продажи");
  });
});

describe("платёжная ссылка курса", () => {
  it("принимает ссылку из кабинета банка", () => {
    expect(isAlfaPaymentUrl("https://ecom.alfabank.by/sc/nezHjoLgDgdLpqjh")).toBe(true);
    expect(isAlfaPaymentUrl("https://alfabank.by/pay/123")).toBe(true);
  });

  it("отклоняет чужой домен — иначе оплату можно увести на сторону", () => {
    expect(isAlfaPaymentUrl("https://ecom.alfabank.by.evil.com/sc/x")).toBe(false);
    expect(isAlfaPaymentUrl("https://example.com/pay")).toBe(false);
  });

  it("требует https и осмысленный адрес", () => {
    expect(isAlfaPaymentUrl("http://ecom.alfabank.by/sc/x")).toBe(false);
    expect(isAlfaPaymentUrl("ecom.alfabank.by/sc/x")).toBe(false);
    expect(isAlfaPaymentUrl("")).toBe(false);
  });

  it("пустое поле допустимо: курс продаётся через заявку", () => {
    expect(alfaPaymentUrlSchema.safeParse("").success).toBe(true);
    expect(alfaPaymentUrlSchema.safeParse(undefined).success).toBe(true);
    expect(alfaPaymentUrlSchema.safeParse("https://example.com").success).toBe(false);
  });
});

describe("двойное кодирование значений", () => {
  // Шлюз присылает кириллицу закодированной дважды, а подпись считает по
  // исходному тексту — на этом ломалась первая боевая оплата.
  const readable = {
    amount: "100",
    mdOrder: "86bee09c-e5fd-784d-a203-5ae9009d7889",
    operation: "reversed",
    orderDescription: "Онлайн-курс, доступ на 12 месяцев.",
    orderNumber: "2002",
    payerEmail: "buyer@example.by",
    status: "1",
  };
  /** То, что остаётся после обычного разбора тела: ещё одна percent-строка. */
  const asDelivered = {
    ...readable,
    orderDescription: encodeURIComponent(readable.orderDescription).replace(/%20/g, "+"),
  };

  it("подпись сходится по раскодированным значениям", () => {
    const checksum = alfaChecksum(readable, TOKEN);
    const verified = verifyAlfaCallback({ ...asDelivered, checksum }, TOKEN);
    expect(verified).not.toBeNull();
    expect(verified?.orderDescription).toBe(readable.orderDescription);
  });

  it("подпись сходится и когда шлюз подписал пришедшие значения как есть", () => {
    const checksum = alfaChecksum(asDelivered, TOKEN);
    const verified = verifyAlfaCallback({ ...asDelivered, checksum }, TOKEN);
    expect(verified?.orderDescription).toBe(asDelivered.orderDescription);
  });

  it("подделку не пропускает ни один из вариантов", () => {
    const checksum = alfaChecksum(readable, "чужой-токен");
    expect(verifyAlfaCallback({ ...asDelivered, checksum }, TOKEN)).toBeNull();
  });

  it("без кириллицы вариант один — лишней работы нет", () => {
    expect(checksumVariants({ amount: "100", status: "1" })).toHaveLength(1);
  });
});
