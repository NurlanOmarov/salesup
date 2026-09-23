import { currency as rateService } from "@/lib/currency";
import type { RatesMap } from "@/lib/currency/rates";
import { fxFromRates, type FxSnapshot } from "./fx";

/**
 * Курсы НБ РК для учёта доходов. Отдельным модулем, потому что нужны в трёх
 * местах: предзаполнение поступления (suggest), снимок курса при записи и
 * пересчёт журнала в две валюты.
 */

/** Курсы без похода в сеть, если кэш уже прогрет: страница админки не ждёт. */
export async function loadRates(): Promise<RatesMap> {
  const cached = rateService.snapshot();
  if (Object.keys(cached.rates).length > 0) return cached.rates;
  const fresh = await rateService.getRates();
  return fresh.rates;
}

/** Снимок курса на сейчас для валюты поступления. */
export async function currentFx(currency: string): Promise<FxSnapshot> {
  return fxFromRates(currency, await loadRates());
}
