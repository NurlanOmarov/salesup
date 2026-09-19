import { escapeHtml } from "@/lib/notify/escape";
import { formatCurrency } from "@/lib/currency/format";
import { env } from "@/env";
import { buyerEmail } from "@/lib/email/templates";
import { emailSupportLinks } from "@/lib/email/support";

/**
 * Тексты уведомлений по оплате в магазине (docs/WOO-INTEGRATION.md).
 * Только формирование строк — отправка идёт задачами `email.send`/`telegram.send`,
 * поэтому модуль чистый и покрыт unit-тестами.
 *
 * В письмо ученику попадает его e-mail и (для новой учётки) временный пароль.
 * В Telegram владельцу ПДн не отправляем — только номер заказа и состав.
 */

export interface AccessGrantedInput {
  email: string;
  /** Названия курсов, к которым открыт доступ. */
  titles: string[];
  /** Временный пароль — только для новой учётки; у существующей пароль свой. */
  tempPassword: string | null;
}

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Письмо покупателю: благодарность, что куплено, как войти и что делать дальше.
 * Вёрстка и тексты — в lib/email/templates (HTML + текстовая версия).
 */
export function accessGrantedEmail({ email, titles, tempPassword }: AccessGrantedInput): EmailPayload {
  const mail = buyerEmail({
    email,
    titles,
    tempPassword,
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    support: emailSupportLinks(),
  });
  return { to: email, ...mail };
}

export interface OwnerPurchaseInput {
  number: string;
  titles: string[];
  totalTiyn: number;
  isNewUser: boolean;
  /** E-mail покупателя — включается в сообщение, только когда письмо отправить нельзя. */
  email?: string;
  /** Временный пароль новой учётки — тоже только как запасной канал (см. ниже). */
  tempPassword?: string | null;
}

/**
 * Сообщение владельцу: продажа прошла и доступ выдан без его участия.
 *
 * Пока `EMAIL_ENABLED=false`, письмо покупателю уйти не может, а временный пароль
 * в открытом виде нигде не хранится — поэтому доступы дописываются сюда, чтобы
 * владелец передал их покупателю сам. Это ровно тот же порядок, каким доступы
 * выдаются вручную в /admin/students, только инициирован оплатой. Как только
 * SMTP настроен, блок исчезает и канал становится полностью автоматическим.
 */
export function ownerPurchaseMessage({
  number,
  titles,
  totalTiyn,
  isNewUser,
  email,
  tempPassword,
}: OwnerPurchaseInput): string {
  const lines = [
    "💳 <b>Оплата курса</b>",
    `Заказ: ${escapeHtml(number)}`,
    `Курсы: ${escapeHtml(titles.join(", "))}`,
    `Сумма: ${escapeHtml(formatCurrency(totalTiyn, "BYN", {}))}`,
    isNewUser ? "Учётка создана, доступ выдан автоматически." : "Доступ добавлен существующему ученику.",
  ];

  if (!env.EMAIL_ENABLED && email) {
    lines.push(
      "",
      "⚠️ <b>Почта выключена — передайте доступ покупателю сами:</b>",
      `Логин: ${escapeHtml(email)}`,
      tempPassword
        ? `Временный пароль: <code>${escapeHtml(tempPassword)}</code>`
        : "Пароль у ученика прежний — он уже учится на платформе.",
    );
  }

  return lines.join("\n");
}
