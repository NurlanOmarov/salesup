/** Секунды → «м:сс» (или «ч:мм:сс» для длинных). Чистая функция (используется в UI и тестах). */
export function formatTimecode(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/**
 * Реплика без собственных кавычек по краям: компоненты оборачивают реплику
 * клиента в «…» сами, а в данных кавычки иногда уже стоят — выходило «««…»»».
 */
export function unquote(text: string): string {
  const t = text.trim();
  // Снимаем только парные кавычки вокруг всей реплики: «Мне „надо подумать“» не трогаем.
  // «Дорого», а у них «дешевле» — тоже не трогаем: внутри остались бы непарные кавычки.
  const inner = t.slice(1, -1);
  return /^[«"“„]/.test(t) && /[»"”“]$/.test(t) && !/[«»"“”„]/.test(inner) ? inner.trim() : t;
}

/**
 * Перемешивание, одинаковое на сервере и в браузере: порядок зависит только от
 * `seed` (обычно — текст вопроса и номер попытки). Случайный shuffle при SSR
 * давал бы рассинхрон гидрации, а без перемешивания верный ответ всегда стоял
 * на одной позиции.
 */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
