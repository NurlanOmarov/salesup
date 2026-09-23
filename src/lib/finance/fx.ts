import { INCOME_CURRENCIES, type IncomeCurrency } from "./split";

/**
 * Две валюты в журнале доходов: тенге и белорусский рубль.
 *
 * Итоги по валютам по-прежнему не смешиваются (D-018) — складывать разные
 * деньги без курса нельзя. А вот одну строку журнала показать в двух валютах
 * можно и нужно: владелец держит в голове и казахстанские, и белорусские
 * поступления, и сравнивать их «на глаз» неудобно.
 *
 * Курс берётся НЕ сегодняшний, а сохранённый в записи на момент её заведения
 * (`Income.kztPerUnitMicro` / `kztPerBynMicro`): сумма в пересчёте — это факт
 * того дня, и меняться задним числом она не должна. Курсы НБ РК заданы как
 * «1 единица валюты = X тенге», поэтому тенге здесь — опорная валюта пересчёта.
 */

/** Валюты, в которых показываем каждую строку журнала. */
export const DISPLAY_PAIR = ["KZT", "BYN"] as const;
export type DisplayCurrency = (typeof DISPLAY_PAIR)[number];

export interface FxSnapshot {
  /** Микротенге за единицу валюты поступления (1 000 000 = 1 тенге). */
  kztPerUnitMicro: number | null;
  /** Микротенге за один белорусский рубль. */
  kztPerBynMicro: number | null;
}

export const EMPTY_FX: FxSnapshot = { kztPerUnitMicro: null, kztPerBynMicro: null };

const MICRO = 1_000_000;

function isIncomeCurrency(v: string): v is IncomeCurrency {
  return (INCOME_CURRENCIES as readonly string[]).includes(v);
}

/**
 * Снимок курса для валюты поступления из карты НБ РК («1 ед. = X тенге»).
 * Курса нет — снимок пустой: лучше не показать вторую валюту, чем показать
 * выдуманную.
 */
export function fxFromRates(currency: string, rates: Record<string, number>): FxSnapshot {
  const perUnit = currency === "KZT" ? 1 : rates[currency];
  const perByn = rates.BYN;
  return {
    kztPerUnitMicro: perUnit && perUnit > 0 ? Math.round(perUnit * MICRO) : null,
    kztPerBynMicro: perByn && perByn > 0 ? Math.round(perByn * MICRO) : null,
  };
}

/**
 * Курс записи, а если его не сохранили — сегодняшний (`approximate: true`,
 * в интерфейсе об этом честно написано).
 */
export function resolveFx(
  stored: FxSnapshot,
  fallback: FxSnapshot,
): { fx: FxSnapshot; approximate: boolean } {
  const complete = stored.kztPerUnitMicro != null && stored.kztPerBynMicro != null;
  return complete ? { fx: stored, approximate: false } : { fx: fallback, approximate: true };
}

/** Сумма записи в одной из двух валют журнала; null — пересчитать нечем. */
export function convertTiyn(
  tiyn: number,
  currency: string,
  target: DisplayCurrency,
  fx: FxSnapshot,
): number | null {
  if (currency === target) return tiyn;
  const { kztPerUnitMicro, kztPerBynMicro } = fx;
  if (!kztPerUnitMicro || kztPerUnitMicro <= 0) return null;
  // Минорные единицы у всех валют поступлений одинаковые (1/100), поэтому
  // достаточно домножить на курс — переводить в «майоры» и обратно не нужно.
  const kzt = (tiyn * kztPerUnitMicro) / MICRO;
  if (target === "KZT") return Math.round(kzt);
  if (!kztPerBynMicro || kztPerBynMicro <= 0) return null;
  return Math.round((kzt * MICRO) / kztPerBynMicro);
}

export interface ConvertedAmount {
  currency: DisplayCurrency;
  tiyn: number;
}

/**
 * Пересчёт суммы в те валюты журнала, которых нет в самой записи: у тенговой
 * строки это бел. рубли, у белорусской — тенге, у рублёвой и сумовой — обе.
 */
export function convertedAmounts(
  tiyn: number,
  currency: string,
  fx: FxSnapshot,
): ConvertedAmount[] {
  const out: ConvertedAmount[] = [];
  for (const target of DISPLAY_PAIR) {
    if (currency === target) continue;
    const value = convertTiyn(tiyn, currency, target, fx);
    if (value != null) out.push({ currency: target, tiyn: value });
  }
  return out;
}

/**
 * Нужен ли свежий курс при правке записи.
 *
 * Обычная правка (дописали заметку, поправили дату) курс не трогает: деньги
 * пришли один раз, и пересчёт того дня не должен «плавать». Но если сменили
 * валюту, старый курс относится к другой валюте и врёт; и если курса в записи
 * нет вовсе — взять свежий лучше, чем остаться без второй валюты.
 */
export function needsFreshFx(
  stored: FxSnapshot & { currency: string },
  nextCurrency: string,
): boolean {
  return (
    stored.currency !== nextCurrency ||
    stored.kztPerUnitMicro == null ||
    stored.kztPerBynMicro == null
  );
}

/** Валюта записи вообще пересчитываема? (страхует от мусора в поле currency) */
export function isKnownCurrency(currency: string): boolean {
  return isIncomeCurrency(currency);
}
