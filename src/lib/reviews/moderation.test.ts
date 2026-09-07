import { describe, it, expect } from "vitest";
import { moderateReview } from "./moderation";

describe("moderateReview", () => {
  it("публикует содержательный отзыв", () => {
    const r = moderateReview(
      "Курс дал конкретные фразы для отработки возражения «дорого» — сразу применил на встрече, сделка закрылась.",
    );
    expect(r.status).toBe("VALIDATED");
    expect(r.note).toBeNull();
  });

  it("короткий отзыв уходит владельцу, а не на витрину", () => {
    expect(moderateReview("Всё супер, спасибо!").status).toBe("PENDING");
  });

  it("отзыв со ссылкой не публикуется автоматически", () => {
    const r = moderateReview(
      "Отличный курс по переговорам, много практики и разборов, рекомендую https://spam.example всем менеджерам",
    );
    expect(r.status).toBe("PENDING");
  });

  it("мат отклоняется", () => {
    const r = moderateReview(
      "Курс норм, но техподдержка пиздец какая медленная, ждал ответа два дня подряд и очень злился",
    );
    expect(r.status).toBe("FAILED");
  });

  it("набор одинаковых символов отклоняется", () => {
    expect(moderateReview("аааааааааааааааааааааааааааааааааааааааааааа").status).toBe(
      "FAILED",
    );
  });
});
