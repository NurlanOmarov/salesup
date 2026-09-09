"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, ChevronDown, Search } from "lucide-react";
import type { CountryCode } from "libphonenumber-js";
import { cn } from "@/lib/utils";
import { countryFlag, countryName } from "@/lib/analytics/format";
import {
  DEFAULT_PHONE_COUNTRY,
  callingCode,
  countryOptions,
  examplePhone,
  parsePhone,
  type PhoneValidity,
} from "@/lib/phone";

/**
 * Поле телефона с выбором кода страны.
 *
 * Код страны выбирается флагом, а не набирается: без него мессенджер номер не
 * находит, и заявка превращается в тупик. Страна подставляется по домену
 * (белорусский домен → +375), но переопределяется — и вручную из списка, и
 * автоматически, если человек вставил номер в международном формате.
 *
 * Наружу отдаётся только E.164; пока номер не разобран — пустая строка, чтобы
 * форма не отправила «почти номер».
 */
export function PhoneInput({
  id,
  name,
  value,
  onChange,
  onValidityChange,
  defaultCountry = DEFAULT_PHONE_COUNTRY,
  placeholder,
  autoFocus,
  hint,
  errorText,
}: {
  id?: string;
  /** Имя скрытого поля: значение уходит в FormData уже нормализованным. */
  name?: string;
  value: string;
  onChange: (e164: string) => void;
  onValidityChange?: (validity: PhoneValidity) => void;
  defaultCountry?: CountryCode;
  placeholder?: string;
  autoFocus?: boolean;
  /** Обычная подсказка под полем. */
  hint?: string;
  /** Текст ошибки; получает готовый пример номера выбранной страны. */
  errorText?: (example: string) => string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Последнее отданное наружу значение: иначе синхронизация с `value` затирала бы
  // набранный текст, пока номер ещё неполон и наружу ушла пустая строка.
  const lastEmitted = useRef("");

  const [country, setCountry] = useState<CountryCode>(defaultCountry);
  const [countryLocked, setCountryLocked] = useState(false);
  const [text, setText] = useState("");
  const [validity, setValidity] = useState<PhoneValidity>("empty");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Пока номер набирают, он неизбежно неполон: ошибку показываем только после
  // того, как поле покинули, — и дальше держим, пока номер не станет верным.
  const [touched, setTouched] = useState(false);

  // Страна домена приезжает после монтирования (её знает только браузер) —
  // подхватываем, пока человек не выбрал код сам и не начал набирать.
  useEffect(() => {
    if (!countryLocked && !text) setCountry(defaultCountry);
  }, [defaultCountry, countryLocked, text]);

  useEffect(() => {
    if (value === lastEmitted.current) return;
    setText((prev) => {
      if (!value) return prev === "" ? prev : "";
      const parsed = parsePhone(value, country);
      return parsed.display || value;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    onValidityChange?.(validity);
  }, [validity, onValidityChange]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const emit = useCallback(
    (next: string, nextValidity: PhoneValidity) => {
      lastEmitted.current = next;
      onChange(next);
      setValidity(nextValidity);
    },
    [onChange],
  );

  const handleChange = (raw: string) => {
    const parsed = parsePhone(raw, country);
    setText(parsed.display || raw);
    // Флаг идёт за разобранным номером: у общего кода +7 казахстанский 707 и
    // российский 912 — разные страны, и показать нужно ту, что в самих цифрах.
    if (parsed.country) setCountry(parsed.country);
    emit(parsed.e164, parsed.validity);
  };

  const handleBlur = () => {
    setTouched(true);
    const parsed = parsePhone(text, country);
    if (parsed.validity === "valid") setText(parsed.display);
  };

  const selectCountry = (next: CountryCode) => {
    setCountry(next);
    setCountryLocked(true);
    setOpen(false);
    setQuery("");
    const parsed = parsePhone(text, next);
    setText(parsed.display || text);
    emit(parsed.e164, parsed.validity);
    inputRef.current?.focus();
  };

  const showError = touched && validity === "invalid";
  // Пример показываем на языке цифр: флаг + номер той страны, что выбрана в поле.
  const example = `${countryFlag(country)} ${examplePhone(country)}`;

  const countries = useMemo(() => countryOptions(), []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, "");
    if (!q) return countries;
    return countries.filter(
      (c) =>
        c.toLowerCase().includes(q) ||
        callingCode(c).includes(q) ||
        countryName(c).toLowerCase().includes(q),
    );
  }, [countries, query]);

  return (
    <div className="relative" ref={boxRef}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <div
        className={cn(
          "flex h-11 items-stretch overflow-hidden rounded-lg border bg-transparent transition-colors",
          showError
            ? "border-red-500/60 bg-red-500/5"
            : validity === "valid"
              ? "border-emerald-500/50"
              : "border-foreground/20 focus-within:ring-2 focus-within:ring-foreground/30",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Код страны"
          aria-expanded={open}
          className="flex shrink-0 items-center gap-1 border-r border-foreground/15 px-2.5 text-sm transition-colors hover:bg-foreground/5"
        >
          <span className="text-lg leading-none">{countryFlag(country)}</span>
          <span className="text-sm text-foreground/70">+{callingCode(country)}</span>
          <ChevronDown className="size-3.5 text-foreground/40" />
        </button>

        <input
          id={id}
          ref={inputRef}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          aria-invalid={showError || undefined}
          placeholder={placeholder ?? examplePhone(country)}
          className="w-full min-w-0 bg-transparent px-3 text-base outline-none placeholder:text-foreground/40"
        />

        <span className="flex shrink-0 items-center pr-3">
          {validity === "valid" ? <Check className="size-4 text-emerald-600" /> : null}
          {showError ? <AlertCircle className="size-4 text-red-500" /> : null}
        </span>
      </div>

      {open ? (
        <div className="absolute z-50 mt-1 max-h-72 w-72 max-w-[calc(100vw-3rem)] overflow-auto rounded-lg border border-foreground/15 bg-background shadow-xl">
          <div className="sticky top-0 border-b border-foreground/10 bg-background p-2">
            <div className="flex items-center gap-2 rounded-md bg-foreground/5 px-2">
              <Search className="size-3.5 text-foreground/40" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Страна или код"
                className="w-full bg-transparent py-1.5 text-sm outline-none placeholder:text-foreground/40"
              />
            </div>
          </div>
          {filtered.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => selectCountry(c)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-foreground/5",
                c === country && "font-medium text-brand",
              )}
            >
              <span className="text-base">{countryFlag(c)}</span>
              <span className="flex-1 truncate">{countryName(c)}</span>
              <span className="text-xs text-foreground/50">+{callingCode(c)}</span>
            </button>
          ))}
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-sm text-foreground/50">Ничего не найдено</p>
          ) : null}
        </div>
      ) : null}

      {showError && errorText ? (
        <p className="mt-1 text-xs font-medium text-red-600">{errorText(example)}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-foreground/50">{hint}</p>
      ) : null}
    </div>
  );
}
