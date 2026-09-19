"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteIncomeAction, updateFinanceSettingsAction } from "./actions";
import { COUNTRIES, COUNTRY_LABELS, type Country } from "@/lib/finance/split";
import { ActionResult, useActionResult } from "@/components/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DeleteIncomeButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    if (!window.confirm(`Удалить поступление ${label}? Выплаты по нему тоже исчезнут из статистики.`)) {
      return;
    }
    setPending(true);
    try {
      const res = await deleteIncomeAction({ id });
      if (res.ok) router.refresh();
      else window.alert(res.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      aria-label="Удалить поступление"
      className="rounded p-1 text-foreground/35 transition-colors hover:bg-red-500/10 hover:text-red-600"
    >
      <Trash2 className="size-4" />
    </button>
  );
}

/**
 * Ставки налогов по странам и доли совладельцев. Меняют только будущие записи:
 * у сохранённых поступлений ставка и доли зафиксированы.
 */
export function FinanceSettingsForm({
  rates,
  coOwners,
}: {
  rates: Record<string, number>;
  coOwners: { id: string; label: string; shareBp: number | null }[];
}) {
  const router = useRouter();
  const feedback = useActionResult();
  const [pending, setPending] = useState(false);
  const [rateInputs, setRateInputs] = useState<Record<Country, string>>(
    () =>
      Object.fromEntries(
        COUNTRIES.map((c) => [c, rates[c] != null ? String(rates[c]! / 1000).replace(".", ",") : ""]),
      ) as Record<Country, string>,
  );
  const [shareInputs, setShareInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(coOwners.map((p) => [p.id, String((p.shareBp ?? 0) / 100).replace(".", ",")])),
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    feedback.clear();
    try {
      const res = await updateFinanceSettingsAction({
        rates: COUNTRIES.filter((c) => rateInputs[c].trim()).map((c) => ({
          country: c,
          percent: rateInputs[c],
        })),
        shares: coOwners.map((p) => ({ payeeId: p.id, percent: shareInputs[p.id] ?? "0" })),
      });
      if (res.ok) {
        feedback.ok("Сохранено. Прошлые поступления не пересчитываются.");
        router.refresh();
      } else {
        const field = res.fieldErrors ? Object.values(res.fieldErrors)[0]?.[0] : undefined;
        feedback.fail(field ?? res.error);
      }
    } catch {
      feedback.fail("Не удалось сохранить — обновите страницу и попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <p className="text-sm font-medium">Налоги и сборы по стране покупателя, %</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-4">
          {COUNTRIES.map((c) => (
            <label key={c} className="block text-sm">
              <span className="text-foreground/60">{COUNTRY_LABELS[c]}</span>
              <Input
                className="mt-1"
                inputMode="decimal"
                value={rateInputs[c]}
                onChange={(e) => setRateInputs((s) => ({ ...s, [c]: e.target.value }))}
              />
            </label>
          ))}
        </div>
      </div>
      {coOwners.length > 0 ? (
        <div>
          <p className="text-sm font-medium">Доля совладельцев от чистой прибыли, %</p>
          <p className="text-xs text-foreground/50">Автор курса получает остаток.</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-4">
            {coOwners.map((p) => (
              <label key={p.id} className="block text-sm">
                <span className="text-foreground/60">{p.label}</span>
                <Input
                  className="mt-1"
                  inputMode="decimal"
                  value={shareInputs[p.id] ?? ""}
                  onChange={(e) => setShareInputs((s) => ({ ...s, [p.id]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          Сохранить настройки
        </Button>
        <ActionResult result={feedback.result} />
      </div>
    </form>
  );
}
