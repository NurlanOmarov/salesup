import type { Prisma } from "@prisma/client";

/**
 * Идентификатор входа: e-mail (розничный ученик, владелец) ИЛИ логин вида
 * `acme-0042` (работник организации — его учётка заводится без e-mail, ПДн
 * платформа не получает: docs/B2B-PLAN.md §5.1, оферта /offer-b2b п. 10.1).
 *
 * Чистая функция без БД — юнит-тестируется отдельно (identity.test.ts).
 */

export type LoginIdentity =
  | { kind: "email"; value: string }
  | { kind: "login"; value: string };

/**
 * Разбирает то, что ввели в единственное поле формы входа. Наличие «@» —
 * достаточный признак e-mail: логины мы генерируем сами и «@» в них не бывает.
 * Регистр не важен ни для e-mail, ни для логина.
 */
export function parseIdentity(raw: string): LoginIdentity | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;

  if (value.includes("@")) {
    // Минимальная проверка формы: «что-то@что-то.что-то» без пробелов.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
    return { kind: "email", value };
  }

  if (!LOGIN_RE.test(value)) return null;
  return { kind: "login", value };
}

/** Формат генерируемого логина: `<slug>-<номер>`, только строчные латиница/цифры/дефис. */
export const LOGIN_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Условие поиска пользователя по разобранному идентификатору. */
export function identityWhere(identity: LoginIdentity): Prisma.UserWhereUniqueInput {
  return identity.kind === "email"
    ? { email: identity.value }
    : { login: identity.value };
}

/**
 * Как показать идентификатор работника/ученика в интерфейсе владельца.
 * Порядок намеренный: у B2B-работника есть только логин, у розничного — e-mail.
 */
export function displayIdentity(user: {
  login?: string | null;
  email?: string | null;
}): string {
  return user.login ?? user.email ?? "—";
}
