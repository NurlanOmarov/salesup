import { storage } from "@/lib/storage";
import { log } from "@/lib/log";

/**
 * Курсы валют Нацбанка РК (nationalbank.kz). Зеркалирует подход transfer-astana
 * (currency_service.py): раз в сутки тянем RSS, парсим rate = description / quant,
 * кэш — 1 ед. иностранной валюты = rate KZT. KZT = 1 (база). Кэш персистится в
 * lib/storage (volume на VPS, готов к миграции на s3) и переживает рестарт.
 */

const NBK_URL = "https://nationalbank.kz/rss/rates_all.xml";
const CACHE_KEY = "system/currency-rates.json";
const TTL_MS = 24 * 60 * 60 * 1000; // сутки

/** Карта курсов: код валюты → стоимость 1 ед. в тенге. KZT = 1. */
export type RatesMap = Record<string, number>;

export interface RatesPayload {
  rates: RatesMap;
  updatedAt: string | null;
}

interface CacheFile {
  rates?: RatesMap;
  updatedAt?: string | null;
}

/** Извлекает значение первого <tag>…</tag> в блоке. */
function pickTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
  const m = block.match(re);
  const val = m?.[1];
  return val ? val.trim() : null;
}

function toNumber(s: string | null): number | null {
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Парсит RSS Нацбанка. Формат item: <title>USD</title><description>470.17</description>
 * <quant>1</quant>. Для валют с quant > 1 (напр. JPY) курс = description / quant.
 * Лёгкий регекс-парсер вместо тяжёлой XML-библиотеки: фид плоский и стабилен.
 */
function parseNbkXml(xml: string): RatesMap {
  const rates: RatesMap = {};
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    if (!block) continue;
    const code = pickTag(block, "title");
    if (!code) continue;
    const description = toNumber(pickTag(block, "description"));
    const quant = toNumber(pickTag(block, "quant")) ?? 1;
    if (description == null || quant <= 0) continue;
    rates[code.toUpperCase()] = description / quant;
  }
  return rates;
}

class CurrencyService {
  private cache: RatesMap = {};
  private updatedAt: Date | null = null;
  private loaded = false;
  private fetching: Promise<void> | null = null;

  /** Загрузка кэша с диска (один раз за процесс). */
  private async loadCache(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await storage.get(CACHE_KEY);
      const data = JSON.parse(raw.toString("utf8")) as CacheFile;
      this.cache = data.rates ?? {};
      this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : null;
    } catch {
      // кэша ещё нет — не критично
    }
  }

  private async saveCache(): Promise<void> {
    try {
      const payload: CacheFile = {
        rates: this.cache,
        updatedAt: this.updatedAt ? this.updatedAt.toISOString() : null,
      };
      await storage.put(CACHE_KEY, JSON.stringify(payload));
    } catch (e) {
      log.error({ err: e }, "currency: не удалось сохранить кэш курсов");
    }
  }

  /** Принудительное обновление курсов из НБ РК. Дедупликатор конкурентных вызовов. */
  async refresh(): Promise<void> {
    if (this.fetching) return this.fetching;
    this.fetching = (async () => {
      try {
        const res = await fetch(NBK_URL, {
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`NBK HTTP ${res.status}`);
        const xml = await res.text();
        const rates = parseNbkXml(xml);
        if (Object.keys(rates).length === 0) {
          throw new Error("пустой ответ НБ РК");
        }
        rates.KZT = 1; // базовая валюта
        this.cache = rates;
        this.updatedAt = new Date();
        await this.saveCache();
        log.info(
          { count: Object.keys(rates).length },
          "currency: курсы НБ РК обновлены",
        );
      } catch (e) {
        log.error({ err: e }, "currency: ошибка обновления курсов НБ РК");
        // сохраняем устаревший кэш — лучше устаревший курс, чем никакого
      } finally {
        this.fetching = null;
      }
    })();
    return this.fetching;
  }

  /**
   * Актуальные курсы. Если кэша нет вообще — блокирующе ждём первый фетч;
   * если кэш протух — фоновое обновление, отдаём то, что есть (без задержки).
   */
  async getRates(): Promise<RatesPayload> {
    await this.loadCache();
    const hasCache = Object.keys(this.cache).length > 0;
    const stale =
      !this.updatedAt || Date.now() - this.updatedAt.getTime() > TTL_MS;
    if (stale && !hasCache) {
      await this.refresh();
    } else if (stale) {
      void this.refresh();
    }
    return {
      rates: this.cache,
      updatedAt: this.updatedAt ? this.updatedAt.toISOString() : null,
    };
  }

  /** Только чтение кэша без триггера фетча (для синхронных расчётов в админке). */
  snapshot(): RatesPayload {
    return {
      rates: this.cache,
      updatedAt: this.updatedAt ? this.updatedAt.toISOString() : null,
    };
  }
}

/** Синглтон сервиса курсов. */
export const currency = new CurrencyService();
