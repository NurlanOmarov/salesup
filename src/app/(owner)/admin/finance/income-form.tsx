"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createIncomeAction, updateIncomeAction } from "./actions";
import {
  COUNTRIES,
  COUNTRY_CURRENCY,
  COUNTRY_FLAGS,
  COUNTRY_LABELS,
  INCOME_CURRENCIES,
  formatBp,
  formatMoney,
  formatRate,
  payeeGross,
  splitIncome,
  type Country,
} from "@/lib/finance/split";
import type { IncomeSuggestion } from "@/lib/finance/suggest";
import { ActionResult, useActionResult } from "@/components/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Справочники, одинаковые для записи и правки поступления. */
export interface IncomeFormLists {
  orgs: { id: string; name: string; site: string | null; billing: string }[];
  courses: { id: string; title: string }[];
  coOwners: { id: string; label: string; shareBp: number | null }[];
  authors: { id: string; label: string }[];
  /** Ставки налогов по странам, процент × 1000. */
  rates: Record<string, number>;
}

/** Сохранённое поступление в виде значений формы — для правки. */
export interface EditableIncome {
  id: string;
  receivedAt: string; // YYYY-MM-DD
  channel: "B2B" | "B2C";
  country: Country;
  currency: string;
  grossTiyn: number;
  taxTiyn: number;
  orgId: string | null;
  courseId: string | null;
  buyerRef: string | null;
  note: string | null;
  /** Получатель-автор из раскладки: кому уходил остаток чистой прибыли. */
  authorId: string | null;
}

interface Props extends IncomeFormLists {
  defaultOrgId?: string | null;
  /** Предзаполнение по лицензиям выбранной организации (lib/finance/suggest). */
  suggestion?: IncomeSuggestion | null;
  /** Задано — форма правит эту запись, а не создаёт новую. */
  income?: EditableIncome;
  /** Правка сохранена: закрыть окно (в режиме создания не нужен). */
  onSaved?: () => void;
}

const selectCls = "h-10 w-full rounded-lg border border-foreground/15 bg-background px-3 text-sm";

/** «44 000» / «44000,5» → минорные единицы; null — не число. */
function parseMoney(s: string): number | null {
  const v = s.replace(/[\s ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  return Math.round(Number(v) * 100);
}

function isCountry(v: string | null | undefined): v is Country {
  return (COUNTRIES as readonly string[]).includes(v ?? "");
}

/**
 * Запись и правка поступления — одна форма на оба случая: поля, проверки и
 * раскладка совпадают, а расходиться им нельзя. Налог подставляется по ставке
 * страны покупателя, но его можно поправить на фактический — тогда раскладка
 * пересчитывается от него.
 */
export function IncomeForm({
  orgs,
  courses,
  coOwners,
  authors,
  rates,
  defaultOrgId,
  suggestion,
  income,
  onSaved,
}: Props) {
  const router = useRouter();
  const feedback = useActionResult();
  const [pending, setPending] = useState(false);

  const editing = income ?? null;
  const defaultOrg = orgs.find((o) => o.id === (editing?.orgId ?? defaultOrgId)) ?? null;
  // Подсказка по лицензиям — только для новой записи: у сохранённой значения
  // уже есть, и подменять их расчётом было бы потерей факта.
  const prefill = !editing && defaultOrg ? (suggestion ?? null) : null;
  const initialCountry: Country =
    editing?.country ?? prefill?.country ?? (isCountry(defaultOrg?.site) ? defaultOrg.site : "KZ");

  const [channel, setChannel] = useState<"B2B" | "B2C">(editing?.channel ?? "B2B");
  const [orgId, setOrgId] = useState(editing?.orgId ?? defaultOrg?.id ?? "");
  const [country, setCountry] = useState<Country>(initialCountry);
  const [currency, setCurrency] = useState<string>(
    editing?.currency ?? prefill?.currency ?? COUNTRY_CURRENCY[initialCountry],
  );
  const [receivedAt, setReceivedAt] = useState(
    () => editing?.receivedAt ?? new Date().toISOString().slice(0, 10),
  );
  // Сумма подставляется расчётом по лицензиям, но остаётся обычным полем:
  // в учёт идёт то, что реально пришло, а не то, что должно было прийти.
  const [gross, setGross] = useState(
    editing ? String(editing.grossTiyn / 100) : prefill?.grossTiyn ? String(prefill.grossTiyn / 100) : "",
  );
  // У сохранённой записи налог показываем как есть: он мог быть поправлен руками.
  const [tax, setTax] = useState(editing ? String(editing.taxTiyn / 100) : "");
  const [authorId, setAuthorId] = useState(editing?.authorId ?? authors[0]?.id ?? "");
  const [courseId, setCourseId] = useState(editing?.courseId ?? prefill?.courseId ?? "");
  const [buyerRef, setBuyerRef] = useState(editing?.buyerRef ?? "");
  const [note, setNote] = useState(editing?.note ?? prefill?.note ?? "");
  // После записи форма снова становится обычной «новой»: оставить подсказку о
  // предзаполнении над уже очищенными полями — значит соврать.
  const [prefillShown, setPrefillShown] = useState(true);

  function pickCountry(c: Country) {
    setCountry(c);
    setCurrency(COUNTRY_CURRENCY[c]);
  }

  function pickOrg(id: string) {
    setOrgId(id);
    const site = orgs.find((o) => o.id === id)?.site;
    if (isCountry(site)) pickCountry(site);
  }

  const rateMilli = rates[country];
  const preview = useMemo(() => {
    const g = parseMoney(gross);
    const author = authors.find((a) => a.id === authorId);
    if (!g || rateMilli == null || !author) return null;
    const t = tax.trim() ? parseMoney(tax) : null;
    if (tax.trim() && t === null) return null;
    try {
      return splitIncome({
        grossTiyn: g,
        rateMilli,
        currency,
        coOwners: coOwners.map((c) => ({ ...c, role: "CO_OWNER" as const })),
        author: { id: author.id, role: "AUTHOR", shareBp: null },
        taxTiyn: t,
      });
    } catch {
      return null;
    }
  }, [gross, tax, rateMilli, currency, coOwners, authors, authorId]);

  const labelOf = (payeeId: string) =>
    [...coOwners, ...authors].find((p) => p.id === payeeId)?.label ?? "?";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    feedback.clear();
    const payload = {
      receivedAt,
      channel,
      country,
      currency,
      gross,
      tax,
      authorId,
      orgId: channel === "B2B" ? orgId : null,
      courseId: courseId || null,
      buyerRef: channel === "B2C" ? buyerRef : null,
      note,
    };
    // Окно правки закрываем уже после того, как форма перестанет быть занятой:
    // иначе состояние обновляется у размонтированного компонента.
    let saved = false;
    try {
      const res = editing
        ? await updateIncomeAction({ ...payload, id: editing.id })
        : await createIncomeAction(payload);
      if (res.ok) {
        const org = orgs.find((o) => o.id === orgId);
        if (editing) {
          feedback.ok("Поступление изменено.");
          router.refresh();
          saved = true;
        } else {
          feedback.ok(
            channel === "B2B" && org?.billing === "PILOT"
              ? `Поступление записано, «${org.name}» теперь отмечена как платная.`
              : channel === "B2B" && org
                ? `Поступление записано — «${org.name}» есть в доходах.`
                : "Поступление записано.",
          );
          setGross("");
          setTax("");
          setBuyerRef("");
          setNote("");
          setCourseId("");
          setPrefillShown(false);
          router.refresh();
        }
      } else {
        const field = res.fieldErrors ? Object.values(res.fieldErrors)[0]?.[0] : undefined;
        feedback.fail(field ?? res.error);
      }
    } catch {
      feedback.fail("Не удалось отправить форму — обновите страницу и попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
    if (saved) onSaved?.();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Откуда взялись цифры: без этого сумма выглядит как чужая догадка,
            и владелец на всякий случай перебивает её вручную. */}
        {prefill && prefillShown ? (
          <div className="rounded-lg border border-amber-600/25 bg-amber-500/5 p-3 text-xs text-foreground/70 sm:col-span-2">
            <p className="text-sm font-medium text-amber-800">
              Заполнено по лицензиям «{defaultOrg?.name}»
            </p>
            <p className="mt-1">
              {prefill.basis}
              {prefill.converted && prefill.grossTiyn
                ? ` → ${formatMoney(prefill.grossTiyn, prefill.currency)} по курсу НБ РК`
                : ""}
              {prefill.estimated && prefill.bynTiyn > 0
                ? ". Цена места в лицензии не записана — посчитано по корпоративной сетке"
                : ""}
              {prefill.ratesMissing
                ? ". Курс НБ РК недоступен — сумму в валюте клиента введите руками"
                : ""}
              .
            </p>
            <p className="mt-1 text-foreground/55">
              Сверьте сумму и дату с выпиской: в учёт идёт то, что реально пришло. Любое
              поле можно поправить.
            </p>
            {prefill.existingIncomes > 0 ? (
              <p className="mt-1 font-medium text-amber-800">
                По этому клиенту уже записано поступлений: {prefill.existingIncomes}.
                Убедитесь, что это новая оплата, а не повтор.
              </p>
            ) : null}
          </div>
        ) : null}
        <Field label="Дата получения оплаты">
          <Input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} required />
        </Field>
        <Field label="Канал">
          <div className="inline-flex h-10 overflow-hidden rounded-lg border border-foreground/15">
            {(["B2B", "B2C"] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={channel === c}
                onClick={() => setChannel(c)}
                className={`px-4 text-sm font-medium ${
                  channel === c ? "bg-amber-500 text-slate-950" : "text-foreground/60 hover:bg-foreground/5"
                }`}
              >
                {c === "B2B" ? "B2B · организация" : "B2C · частное лицо"}
              </button>
            ))}
          </div>
        </Field>

        {channel === "B2B" ? (
          <Field label="Организация">
            <select value={orgId} onChange={(e) => pickOrg(e.target.value)} className={selectCls} required>
              <option value="">— выберите —</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.billing === "PILOT" ? " (пилот)" : ""}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Покупатель" hint="номер заказа или пометка — без ФИО и контактов">
            <Input value={buyerRef} onChange={(e) => setBuyerRef(e.target.value)} maxLength={80} />
          </Field>
        )}
        <Field label="Курс">
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={selectCls}>
            <option value="">— не указан / несколько —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Страна покупателя"
          hint={rateMilli != null ? `налоги и сборы ${formatRate(rateMilli)}` : "ставка не задана"}
        >
          <select value={country} onChange={(e) => pickCountry(e.target.value as Country)} className={selectCls}>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {COUNTRY_FLAGS[c]} {COUNTRY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Валюта">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectCls}>
            {INCOME_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Получено">
          <Input
            inputMode="decimal"
            placeholder="44 000"
            value={gross}
            onChange={(e) => setGross(e.target.value)}
            required
          />
        </Field>
        <Field label="Налоги и сборы" hint="пусто — по ставке страны">
          <Input
            inputMode="decimal"
            placeholder={preview && !tax.trim() ? String(preview.taxTiyn / 100) : "по ставке"}
            value={tax}
            onChange={(e) => setTax(e.target.value)}
          />
        </Field>

        {authors.length > 1 ? (
          <Field label="Автор курса">
            <select value={authorId} onChange={(e) => setAuthorId(e.target.value)} className={selectCls}>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Заметка" hint="номер счёта, договорённость" wide={authors.length <= 1}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
      </div>

      {/* Раскладка считается сразу — видно, кто сколько получит, до сохранения. */}
      <div className="flex flex-col rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Раскладка</p>
        {preview ? (
          <dl className="mt-3 space-y-1.5 tabular-nums">
            <Row label="Получено" value={formatMoney(parseMoney(gross)!, currency)} />
            <Row label="Налоги и сборы" value={`− ${formatMoney(preview.taxTiyn, currency)}`} muted />
            <Row label="Чистая прибыль" value={formatMoney(preview.netTiyn, currency)} strong />
            <div className="my-2 border-t border-foreground/10" />
            {preview.shares.map((s) => (
              <div key={s.payeeId}>
                <Row
                  label={`${labelOf(s.payeeId)} · ${formatBp(s.shareBp)}`}
                  value={formatMoney(s.amountTiyn, currency)}
                  strong
                />
                {preview.netTiyn > 0 ? (
                  <p className="text-right text-xs text-foreground/45">
                    доход{" "}
                    {formatMoney(payeeGross(s.amountTiyn, preview.netTiyn, parseMoney(gross)!), currency)}
                  </p>
                ) : null}
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-foreground/50">Введите сумму — здесь появится, кто сколько получает.</p>
        )}
        <div className="mt-auto pt-4">
          <Button type="submit" disabled={pending || !preview} className="w-full">
            {editing ? "Сохранить изменения" : "Записать поступление"}
          </Button>
          {editing ? (
            <p className="mt-2 text-xs text-foreground/45">
              Ставка налога и курс валют остаются теми, что были при записи; сменится
              страна или валюта — возьмутся текущие.
            </p>
          ) : null}
          <ActionResult result={feedback.result} className="mt-2" />
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="font-medium">{label}</span>
      {hint ? <span className="ml-1.5 text-xs text-foreground/45">{hint}</span> : null}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-3 ${muted ? "text-foreground/55" : ""} ${strong ? "font-semibold" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
