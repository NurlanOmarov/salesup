import { describe, it, expect, vi, beforeEach } from "vitest";
import { currency } from "@/lib/currency/rates";

// Реальный фрагмент RSS Нацбанка РК (rates_all.xml): item с title/description/quant.
const SAMPLE_XML = `<?xml version="1.0" encoding="windows-1251"?>
<rss version="2.0">
  <channel>
    <title>Национальный Банк Казахстана</title>
    <item>
      <title>USD</title>
      <link>https://nationalbank.kz/rss/rates_all.xml</link>
      <description>470.17</description>
      <pubDate>Fri, 18 May 2026 12:00:00 +0600</pubDate>
      <quant>1</quant>
      <index>USD/KZT</index>
    </item>
    <item>
      <title>RUB</title>
      <description>96.30</description>
      <quant>10</quant>
    </item>
    <item>
      <title>BYN</title>
      <description>169.35</description>
      <quant>1</quant>
    </item>
    <item>
      <title>JPY</title>
      <description>2.97</description>
      <quant>1</quant>
    </item>
  </channel>
</rss>`;

// Доступ к приватному парсеру через тест-двойник fetch.
describe("currency.refresh — парсинг RSS Нацбанка", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(SAMPLE_XML),
      }),
    );
  });

  it("извлекает курсы с учётом quant (description / quant)", async () => {
    await currency.getRates();
    // Принудительное обновление подставленным фидом.
    await currency.refresh();
    const snap = currency.snapshot();
    expect(snap.rates.USD).toBeCloseTo(470.17, 2);
    // RUB: 96.30 / 10 = 9.63 за 1 ₽
    expect(snap.rates.RUB).toBeCloseTo(9.63, 2);
    expect(snap.rates.BYN).toBeCloseTo(169.35, 2);
  });

  it("KZT всегда = 1 (базовая валюта)", async () => {
    await currency.refresh();
    expect(currency.snapshot().rates.KZT).toBe(1);
  });
});
