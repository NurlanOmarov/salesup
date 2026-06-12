import { hash, verify } from "@node-rs/argon2";

/**
 * Хеширование паролей argon2id (CLAUDE.md, правило 3).
 * Параметры — рекомендованные OWASP для argon2id (m=19MiB, t=2, p=1).
 */
const OPTIONS = {
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(
  hashed: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}
