"use client";

import { useState, useTransition } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { updateSeoScopeOverrideAction } from "./actions";

/**
 * Переопределения SEO для одного домена или языка (мультидомен, D-013).
 *
 * Правило формы: пустое поле = наследовать значение «для всех доменов», поэтому
 * в placeholder показывается унаследованное значение. Так владелец видит, что
 * получит поисковик, и заполняет только то, что реально отличается.
 */
export interface ScopeOverrideFields {
  titleTemplate: string;
  defaultTitle: string;
  defaultDescription: string;
  googleVerification: string;
  yandexVerification: string;
  ga4Id: string;
  yandexMetricaId: string;
  orgDescription: string;
  orgCountry: string;
  orgPhone: string;
  supportWhatsapp: string;
  socialTelegram: string;
}

const FIELDS: {
  key: keyof ScopeOverrideFields;
  label: string;
  hint?: string;
  wide?: boolean;
  textarea?: boolean;
}[] = [
  { key: "defaultTitle", label: "Заголовок главной", wide: true, hint: "Место для гео-запроса: «курсы по продажам в Казахстане»" },
  { key: "defaultDescription", label: "Описание по умолчанию", wide: true, textarea: true },
  { key: "titleTemplate", label: "Шаблон title", hint: "%s · ACTIVE SALES" },
  { key: "orgCountry", label: "Страна обслуживания", hint: "areaServed в разметке организации" },
  { key: "googleVerification", label: "Google Search Console", hint: "Свой код на каждый ресурс" },
  { key: "yandexVerification", label: "Яндекс.Вебмастер", hint: "Обязателен для .ru — там же задаётся регион" },
  { key: "ga4Id", label: "GA4 ID" },
  { key: "yandexMetricaId", label: "Метрика ID" },
  { key: "orgPhone", label: "Телефон поддержки", hint: "Местный номер, если он есть" },
  { key: "supportWhatsapp", label: "WhatsApp-ссылка" },
  { key: "socialTelegram", label: "Telegram" },
  { key: "orgDescription", label: "Описание организации", wide: true, textarea: true },
];

const inputCls =
  "mt-1 block w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20";

export function ScopeOverrideForm({
  scope,
  scopeLabel,
  values,
  inherited,
}: {
  scope: string;
  scopeLabel: string;
  values: ScopeOverrideFields;
  /** Что действует сейчас без переопределения — показываем в placeholder. */
  inherited: Partial<Record<keyof ScopeOverrideFields, string | null>>;
}) {
  const [form, setForm] = useState(values);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<"ok" | "error" | null>(null);

  const set = (key: keyof ScopeOverrideFields, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setResult(null);
  };

  const submit = () =>
    start(async () => {
      const res = await updateSeoScopeOverrideAction({ scope, ...form });
      setResult(res.ok ? "ok" : "error");
    });

  const filled = Object.values(form).filter((v) => v.trim()).length;

  return (
    <section className="mt-6 rounded-xl border border-foreground/10 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground/80">
          Переопределения: {scopeLabel}
        </h2>
        <p className="text-xs text-foreground/50">
          Заполнено {filled} из {FIELDS.length} · пустое поле наследуется
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.wide ? "sm:col-span-2" : undefined}>
            <label className="block text-sm font-medium text-foreground/80" htmlFor={`${scope}-${f.key}`}>
              {f.label}
            </label>
            {f.textarea ? (
              <textarea
                id={`${scope}-${f.key}`}
                rows={2}
                className={inputCls}
                placeholder={inherited[f.key] ?? "— не задано"}
                value={form[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
              />
            ) : (
              <input
                id={`${scope}-${f.key}`}
                className={inputCls}
                placeholder={inherited[f.key] ?? "— не задано"}
                value={form[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
            {f.hint ? <p className="mt-1 text-xs text-foreground/45">{f.hint}</p> : null}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Сохранить
        </button>
        {result === "ok" ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 className="size-4" /> Сохранено
          </span>
        ) : null}
        {result === "error" ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="size-4" /> Не удалось сохранить
          </span>
        ) : null}
      </div>
    </section>
  );
}
