import { randomInt } from "node:crypto";

/**
 * Генерация временного пароля для выдачи ученику админом (CLAUDE.md, правило 3).
 * Без неоднозначных символов (0/O, 1/l/I) — пароль диктуется/копируется вручную.
 * Формат: 3 группы по 4 символа через дефис, напр. «Kx7-9pTm-q4Rs» (читаемо, ~71 бит).
 */

// Алфавит без 0,O,o,1,l,I,i — чтобы не путать при ручной передаче.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const GROUPS = 3;
const GROUP_LEN = 4;

export function generateTempPassword(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let s = "";
    for (let i = 0; i < GROUP_LEN; i++) {
      s += ALPHABET[randomInt(ALPHABET.length)];
    }
    groups.push(s);
  }
  return groups.join("-");
}
