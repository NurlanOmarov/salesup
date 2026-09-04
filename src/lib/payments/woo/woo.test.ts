import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWooSignature, wooSignature } from "./signature.js";
import {
  orderNumber,
  outcomeOf,
  payerEmail,
  purchasedItems,
  toTiyn,
  wooEventId,
  wooOrderSchema,
  wooPingSchema,
} from "./order.js";
import { accessGrantedEmail, ownerPurchaseMessage } from "./notify.js";
import { shopCheckoutUrl } from "./links.js";

const SECRET = "woo-shared-secret";

/** Заказ в том виде, в каком его присылает WooCommerce (лишние поля опущены). */
const rawOrder = {
  id: 30412,
  number: "30412",
  status: "processing",
  currency: "BYN",
  total: "590.00",
  date_paid_gmt: "2026-08-18T09:15:00",
  transaction_id: "abc-123",
  billing: { email: "Buyer@Example.by", first_name: "Иван", phone: "+375291112233" },
  line_items: [
    { id: 1, product_id: 23916, sku: "sales-kitchens", name: "Кухни 2.0", quantity: 1, total: "590.00" },
  ],
};

describe("подпись webhook", () => {
  it("принимает подпись, посчитанную магазином по сырому телу", () => {
    const body = JSON.stringify(rawOrder);
    const header = createHmac("sha256", SECRET).update(body, "utf8").digest("base64");
    expect(verifyWooSignature(body, header, SECRET)).toBe(true);
    expect(wooSignature(body, SECRET)).toBe(header);
  });

  it("отклоняет подделку, чужой секрет и пустой заголовок", () => {
    const body = JSON.stringify(rawOrder);
    const header = wooSignature(body, SECRET);
    expect(verifyWooSignature(body, header, "другой-секрет")).toBe(false);
    expect(verifyWooSignature(`${body} `, header, SECRET)).toBe(false);
    expect(verifyWooSignature(body, null, SECRET)).toBe(false);
    expect(verifyWooSignature(body, "", SECRET)).toBe(false);
  });

  it("не падает на подписи другой длины", () => {
    expect(verifyWooSignature("{}", "короткая", SECRET)).toBe(false);
  });
});

describe("разбор заказа", () => {
  it("читает заказ и отбрасывает всё, кроме e-mail, из billing", () => {
    const order = wooOrderSchema.parse(rawOrder);
    expect(payerEmail(order)).toBe("buyer@example.by");
    expect(orderNumber(order)).toBe("30412");
    // имя и телефон в разобранный заказ не попадают — ПДн минимизированы (правило 9)
    expect(JSON.stringify(order)).not.toContain("375291112233");
    expect(JSON.stringify(order)).not.toContain("Иван");
  });

  it("узнаёт пинг при создании вебхука", () => {
    expect(wooPingSchema.safeParse({ webhook_id: 12 }).success).toBe(true);
    expect(wooPingSchema.safeParse(rawOrder).success).toBe(false);
  });

  it("считает деньги в копейках без плавающей погрешности", () => {
    expect(toTiyn("590.00")).toBe(59_000);
    expect(toTiyn("0.1")).toBe(10);
    expect(toTiyn(null)).toBe(0);
    expect(toTiyn("не число")).toBe(0);
  });

  it("собирает позиции заказа", () => {
    const items = purchasedItems(wooOrderSchema.parse(rawOrder));
    expect(items).toEqual([
      { productId: 23916, sku: "sales-kitchens", quantity: 1, totalTiyn: 59_000 },
    ]);
  });

  it("товар без артикула остаётся с productId — сопоставим по нему", () => {
    const order = wooOrderSchema.parse({
      ...rawOrder,
      line_items: [{ product_id: 24242, sku: null, quantity: 1, total: "490.00" }],
    });
    expect(purchasedItems(order)[0]).toMatchObject({ productId: 24242, sku: null });
  });
});

describe("статус заказа", () => {
  it("открывает доступ на processing и completed", () => {
    expect(outcomeOf("processing")).toBe("paid");
    expect(outcomeOf("completed")).toBe("paid");
    expect(outcomeOf("wc-completed")).toBe("paid");
    expect(outcomeOf("COMPLETED")).toBe("paid");
  });

  it("отзывает доступ на возврате и отмене", () => {
    expect(outcomeOf("refunded")).toBe("revoked");
    expect(outcomeOf("cancelled")).toBe("revoked");
  });

  it("не реагирует на промежуточные статусы", () => {
    expect(outcomeOf("pending")).toBe("ignore");
    expect(outcomeOf("on-hold")).toBe("ignore");
    expect(outcomeOf("failed")).toBe("ignore");
  });
});

describe("ключ идемпотентности", () => {
  it("один и тот же для повторной доставки, разный для смены статуса", () => {
    const order = wooOrderSchema.parse(rawOrder);
    expect(wooEventId(order, "processing")).toBe(wooEventId(order, "wc-processing"));
    expect(wooEventId(order, "completed")).not.toBe(wooEventId(order, "processing"));
  });
});

describe("уведомления", () => {
  it("новому ученику даёт логин и временный пароль", () => {
    const mail = accessGrantedEmail({
      email: "buyer@example.by",
      titles: ["Эффективные продажи кухонь 2.0"],
      tempPassword: "Kx7-9pTm-q4Rs",
    });
    expect(mail.to).toBe("buyer@example.by");
    expect(mail.text).toContain("Kx7-9pTm-q4Rs");
    expect(mail.text).toContain("Эффективные продажи кухонь 2.0");
    expect(mail.text).toContain("/login");
  });

  it("существующему ученику пароль не присылает", () => {
    const mail = accessGrantedEmail({
      email: "buyer@example.by",
      titles: ["СПИН-продажи"],
      tempPassword: null,
    });
    expect(mail.text).not.toContain("Временный пароль");
    expect(mail.text).toContain("входите обычным паролем");
  });

  it("владельцу шлёт номер заказа и сумму, без ПДн покупателя", () => {
    const text = ownerPurchaseMessage({
      number: "30412",
      titles: ["Кухни 2.0"],
      totalTiyn: 59_000,
      isNewUser: true,
    });
    expect(text).toContain("30412");
    expect(text).toContain("590\u00A0бел.\u00A0руб.");
    expect(text).not.toContain("@");
  });
});

describe("ссылка в магазин", () => {
  it("кладёт товар в корзину и открывает оформление", () => {
    expect(shopCheckoutUrl("https://activesales.by", 23916)).toBe(
      "https://activesales.by/cart/?add-to-cart=23916",
    );
  });

  it("не удваивает слэш, если адрес магазина с ним", () => {
    expect(shopCheckoutUrl("https://activesales.by/", 250)).toBe(
      "https://activesales.by/cart/?add-to-cart=250",
    );
  });
});
