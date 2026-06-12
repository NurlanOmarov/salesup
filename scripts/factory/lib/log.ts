/* Простое цветное логирование для CLI-фабрики (Node-окружение, локально). */

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string, s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);

export const c = {
  dim: (s: string) => paint("2", s),
  bold: (s: string) => paint("1", s),
  green: (s: string) => paint("32", s),
  yellow: (s: string) => paint("33", s),
  red: (s: string) => paint("31", s),
  cyan: (s: string) => paint("36", s),
};

export const log = {
  step: (msg: string) => console.log(`${c.cyan("▶")} ${msg}`),
  info: (msg: string) => console.log(`  ${c.dim(msg)}`),
  ok: (msg: string) => console.log(`${c.green("✓")} ${msg}`),
  warn: (msg: string) => console.warn(`${c.yellow("⚠")} ${msg}`),
  err: (msg: string) => console.error(`${c.red("✗")} ${msg}`),
};

/** Человекочитаемый размер в байтах. */
export function humanSize(bytes: number): string {
  const u = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

/** mm:ss из секунд. */
export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
