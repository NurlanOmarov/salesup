"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, AtSign, Check, Mail, Phone } from "lucide-react";
import type { CountryCode } from "libphonenumber-js";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/client";
import { messagesFor } from "@/i18n/messages";
import { PhoneInput } from "@/components/ui/phone-input";
import { DEFAULT_PHONE_COUNTRY, isSupportedCountry } from "@/lib/phone";
import { DEFAULT_SITE, matchSiteHost } from "@/lib/seo/site-hosts";
import {
  CONTACT_LABELS,
  DEFAULT_CONTACT_TYPE,
  isValidEmail,
  isValidTelegramUsername,
  normalizeTelegramUsername,
  type ContactType,
} from "@/lib/leads/contact";

/**
 * Выбор канала связи в форме заявки.
 *
 * По умолчанию — мессенджер: заявки с одной почтой оборачивались молчанием на
 * сутки, хотя человеку можно было написать сразу. Viber показываем только на
 * белорусской витрине — там он живой канал, на остальных рынках это лишняя
 * вкладка (та же логика, что у контактов поддержки в lib/seo/country-contacts).
 *
 * Наружу уходят два скрытых поля: `contactType` и уже нормализованный
 * `contact` (E.164, `@username` или адрес почты).
 */

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.8h-.02a9.8 9.8 0 0 1-4.99-1.37l-.36-.21-3.71.97.99-3.62-.23-.37a9.79 9.79 0 0 1-1.5-5.23c0-5.41 4.4-9.81 9.82-9.81 2.62 0 5.09 1.02 6.94 2.88a9.75 9.75 0 0 1 2.87 6.94c0 5.41-4.4 9.82-9.81 9.82M20.52 3.45A11.7 11.7 0 0 0 12.05 0C5.55 0 .26 5.29.26 11.79c0 2.08.54 4.11 1.58 5.9L.16 24l6.45-1.69a11.75 11.75 0 0 0 5.44 1.39h.01c6.5 0 11.79-5.29 11.79-11.79 0-3.15-1.23-6.11-3.45-8.34" />
  </svg>
);

const TelegramIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M11.94 24c6.6 0 11.95-5.37 11.95-12S18.54 0 11.94 0 0 5.37 0 12s5.35 12 11.94 12m5.5-17.1-2.02 9.6c-.15.68-.55.85-1.12.53l-3.09-2.29-1.49 1.44c-.16.17-.3.31-.62.31l.22-3.16 5.73-5.2c.25-.22-.05-.35-.39-.13l-7.08 4.48-3.05-.96c-.66-.21-.67-.66.14-.98l11.92-4.63c.55-.2 1.04.13.85.99" />
  </svg>
);

const ViberIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M11.4 0C9.5 0 5.6.3 3.4 2.3 1.8 3.9 1.2 6.3 1.1 9.3c0 3 0 6.6 3.5 7.6v3.6c0 .6.7.9 1.1.5l2.2-2.4c1 .1 1.9.1 2.7.1 1.9 0 5.8-.3 8-2.3 1.7-1.6 2.2-4 2.3-7 0-3-.6-5.4-2.3-7C16.5.3 12.6 0 11.4 0m.1 1.6c1.6 0 5 .2 6.8 1.9 1.3 1.2 1.8 3.2 1.8 5.8 0 2.6-.5 4.6-1.8 5.8-1.8 1.7-5.2 1.9-6.8 1.9-.8 0-1.8 0-2.9-.2l-2 2.2v-2.7C3.5 15.4 3 12.6 3 9.3c0-2.6.5-4.6 1.8-5.8C6.5 1.8 9.9 1.6 11.5 1.6M9.3 4.6c-.3 0-.6.1-.9.3l-.7.5c-.6.5-.8 1.2-.6 1.9.5 1.6 1.4 3 2.5 4.2 1.2 1.2 2.6 2.1 4.2 2.6.7.2 1.4 0 1.9-.6l.5-.6c.4-.5.4-1.2-.1-1.6l-1.4-1c-.4-.3-1-.2-1.4.2l-.4.5c-.2.2-.5.3-.7.1a8 8 0 0 1-2.5-2.5c-.2-.2-.1-.5.1-.7l.5-.4c.4-.4.5-1 .2-1.4l-1-1.4c-.2-.2-.5-.4-.8-.4zm1.8.5c-.3 0-.5.2-.5.4 0 .3.2.5.4.5 1.8.2 3.2 1.6 3.4 3.4 0 .3.3.5.5.4.3 0 .5-.2.4-.5-.2-2.3-2-4-4.2-4.2m0 1.8c-.3 0-.5.1-.5.4s.1.5.4.6c.9.2 1.5.8 1.6 1.6 0 .3.3.5.6.4.3 0 .5-.3.4-.6-.2-1.2-1.2-2.2-2.5-2.4" />
  </svg>
);

export function ContactChannel() {
  const t = messagesFor(useLocale()).lead;

  // Домен известен только в браузере: страницы курсов статические (ISR), и
  // тянуть в них заголовки запроса ради флага было бы дороже, чем узнать хост
  // после монтирования.
  // Неизвестный хост (dev, превью) читается как домен по умолчанию — так же,
  // как в остальном мультидомене (lib/seo/site-hosts).
  const [site, setSite] = useState<string>(DEFAULT_SITE.code);
  useEffect(() => {
    setSite(matchSiteHost(window.location.hostname)?.code ?? DEFAULT_SITE.code);
  }, []);

  const defaultCountry: CountryCode = isSupportedCountry(site)
    ? (site as CountryCode)
    : DEFAULT_PHONE_COUNTRY;

  const types = useMemo<ContactType[]>(
    () =>
      site === "BY"
        ? ["WHATSAPP", "TELEGRAM", "VIBER", "EMAIL"]
        : ["WHATSAPP", "TELEGRAM", "EMAIL"],
    [site],
  );

  const [type, setType] = useState<ContactType>(DEFAULT_CONTACT_TYPE);
  const [phone, setPhone] = useState("");
  const [tgMode, setTgMode] = useState<"username" | "phone">("username");
  const [tgUsername, setTgUsername] = useState("");
  const [email, setEmail] = useState("");
  // «Поле уже покидали»: пока человек набирает, значение неизбежно неполно —
  // красная рамка на первом же символе выглядит как придирка.
  const [tgTouched, setTgTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  const usernameOk = isValidTelegramUsername(tgUsername);
  const emailOk = isValidEmail(email);
  const usernameError = tgTouched && !!tgUsername && !usernameOk;
  const emailError = emailTouched && !!email && !emailOk;

  const value =
    type === "EMAIL"
      ? emailOk
        ? email.trim().toLowerCase()
        : ""
      : type === "TELEGRAM" && tgMode === "username"
        ? usernameOk
          ? `@${normalizeTelegramUsername(tgUsername)}`
          : ""
        : phone;

  // Номер между телефонными каналами сохраняется: WhatsApp, Viber и Telegram —
  // это один и тот же номер, и заставлять набирать его заново незачем. Значения
  // разных типов (ник, почта) живут в своём состоянии и не смешиваются.
  const switchType = (next: ContactType) => setType(next);

  const showPhone = type === "WHATSAPP" || type === "VIBER" || (type === "TELEGRAM" && tgMode === "phone");
  const icon = (channel: ContactType, className: string) =>
    channel === "WHATSAPP" ? <WhatsAppIcon className={className} />
      : channel === "TELEGRAM" ? <TelegramIcon className={className} />
        : channel === "VIBER" ? <ViberIcon className={className} />
          : <Mail className={className} />;

  return (
    <div className="space-y-2">
      <input type="hidden" name="contactType" value={type} />
      <input type="hidden" name="contact" value={value} />

      <div
        className="grid gap-1 rounded-lg border border-foreground/10 bg-foreground/5 p-1"
        style={{ gridTemplateColumns: `repeat(${types.length}, minmax(0, 1fr))` }}
      >
        {types.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => switchType(option)}
            aria-pressed={option === type}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-1 py-2 text-xs font-semibold transition-colors",
              option === type
                ? "bg-background text-brand shadow-sm"
                : "text-foreground/60 hover:text-foreground",
            )}
          >
            {icon(option, "size-3.5 shrink-0")}
            <span className="truncate">{CONTACT_LABELS[option]}</span>
          </button>
        ))}
      </div>

      {type === "TELEGRAM" ? (
        <div className="flex gap-1.5 text-xs">
          {(["username", "phone"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTgMode(mode)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 transition-colors",
                tgMode === mode
                  ? "border-brand/50 bg-brand/10 text-brand-strong"
                  : "border-foreground/15 text-foreground/60 hover:text-foreground",
              )}
            >
              {mode === "username" ? <AtSign className="size-3" /> : <Phone className="size-3" />}
              {mode === "username" ? t.telegramUsernameTab : t.telegramPhoneTab}
            </button>
          ))}
        </div>
      ) : null}

      {showPhone ? (
        <PhoneInput
          id="lead-contact"
          value={phone}
          onChange={setPhone}
          defaultCountry={defaultCountry}
          hint={t.contactPhoneHint}
          errorText={t.contactPhoneError}
        />
      ) : null}

      {type === "TELEGRAM" && tgMode === "username" ? (
        <div>
          <div
            className={cn(
              "flex h-11 items-stretch overflow-hidden rounded-lg border transition-colors",
              usernameError
                ? "border-red-500/60 bg-red-500/5"
                : usernameOk
                  ? "border-emerald-500/50"
                  : "border-foreground/20 focus-within:ring-2 focus-within:ring-foreground/30",
            )}
          >
            <span className="flex items-center border-r border-foreground/15 px-3 text-foreground/50">@</span>
            <input
              id="lead-contact"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={tgUsername}
              onChange={(e) => setTgUsername(e.target.value)}
              onBlur={() => setTgTouched(true)}
              aria-invalid={usernameError || undefined}
              placeholder={t.telegramPlaceholder}
              className="w-full min-w-0 bg-transparent px-3 text-base outline-none placeholder:text-foreground/40"
            />
            <span className="flex shrink-0 items-center pr-3">
              {usernameOk ? <Check className="size-4 text-emerald-600" /> : null}
              {usernameError ? <AlertCircle className="size-4 text-red-500" /> : null}
            </span>
          </div>
          <p
            className={cn(
              "mt-1 text-xs",
              usernameError ? "font-medium text-red-600" : "text-foreground/50",
            )}
          >
            {usernameError ? t.telegramError : t.telegramHint}
          </p>
        </div>
      ) : null}

      {type === "EMAIL" ? (
        <div>
          <div
            className={cn(
              "flex h-11 items-stretch overflow-hidden rounded-lg border transition-colors",
              emailError
                ? "border-red-500/60 bg-red-500/5"
                : emailOk
                  ? "border-emerald-500/50"
                  : "border-foreground/20 focus-within:ring-2 focus-within:ring-foreground/30",
            )}
          >
            <span className="flex items-center border-r border-foreground/15 px-3">
              <Mail className="size-4 text-foreground/40" />
            </span>
            <input
              id="lead-contact"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              aria-invalid={emailError || undefined}
              placeholder={t.emailPlaceholder}
              className="w-full min-w-0 bg-transparent px-3 text-base outline-none placeholder:text-foreground/40"
            />
            <span className="flex shrink-0 items-center pr-3">
              {emailOk ? <Check className="size-4 text-emerald-600" /> : null}
              {emailError ? <AlertCircle className="size-4 text-red-500" /> : null}
            </span>
          </div>
          <p
            className={cn(
              "mt-1 text-xs",
              emailError ? "font-medium text-red-600" : "text-foreground/50",
            )}
          >
            {emailError ? t.emailError : t.contactEmailHint}
          </p>
        </div>
      ) : null}
    </div>
  );
}
