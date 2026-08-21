"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { MIN_PIN_LENGTH, validatePin } from "@/lib/org/crypto";
import { useOrgKey } from "../org-key-provider";
import { Button } from "@/components/ui/button";

/**
 * Ввод или создание ПИН-кода прямо в строке работника.
 *
 * Полоска сверху объясняет механику целиком, но начинают не с неё: человек
 * приходит на страницу «дать имя вот этому работнику», жмёт на строку — и
 * упирается в то, что сначала надо что-то настроить где-то ещё. Поэтому код
 * заводится там же, где возникла потребность, а полоска остаётся для статуса.
 */
export function InlinePin({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const { status, unlock, setup } = useOrgKey();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reveal, setReveal] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [ack, setAck] = useState(false);

  const field =
    "h-8 w-28 rounded-md border border-foreground/15 bg-background px-2 text-sm";

  // Код восстановления показывается один раз — до подтверждения дальше не пускаем.
  if (recoveryCode) {
    return (
      <div className="mt-1 max-w-md rounded-lg border border-emerald-600/30 bg-emerald-500/5 p-2.5">
        <p className="text-xs text-foreground/75">
          Запишите код восстановления — без него забытый ПИН означает потерю имён.
        </p>
        <p className="mt-1.5 rounded border border-foreground/10 bg-background px-2 py-1.5 text-center font-mono text-sm tracking-wider">
          {recoveryCode}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(recoveryCode).then(() => setCopied(true));
            }}
          >
            {copied ? <Check className="mr-1.5 size-3.5" /> : <Copy className="mr-1.5 size-3.5" />}
            Скопировать
          </Button>
          <label className="flex items-center gap-1.5 text-xs text-foreground/70">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="size-3.5"
            />
            Записал
          </label>
          <Button size="sm" disabled={!ack} onClick={onDone}>
            Дальше
          </Button>
        </div>
      </div>
    );
  }

  const creating = status === "not-configured";

  return (
    <div className="mt-1 max-w-md rounded-lg border border-foreground/15 bg-background p-2.5">
      <p className="text-xs text-foreground/70">
        {creating
          ? `Придумайте ПИН-код (от ${MIN_PIN_LENGTH} знаков) — им шифруются имена всех работников. Запомните его: забытый код восстановить нельзя.`
          : "Введите ПИН-код, которым зашифрованы имена."}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <div className="relative">
          <input
            autoFocus
            type={reveal ? "text" : "password"}
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="ПИН-код"
            className={`${field} pr-7`}
            onKeyDown={(e) => {
              if (e.key === "Escape") onCancel();
              if (e.key === "Enter" && !creating) void submit();
            }}
          />
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? "Скрыть" : "Показать"}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground"
          >
            {reveal ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        </div>

        {creating ? (
          <input
            type={reveal ? "text" : "password"}
            inputMode="numeric"
            autoComplete="off"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Повторите"
            className={field}
            onKeyDown={(e) => {
              if (e.key === "Escape") onCancel();
              if (e.key === "Enter") void submit();
            }}
          />
        ) : null}

        <Button size="sm" disabled={pending} onClick={() => void submit()}>
          {pending ? "Проверяем…" : creating ? "Включить" : "Показать имена"}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-foreground/50 hover:underline"
        >
          отмена
        </button>
      </div>

      {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
    </div>
  );

  async function submit() {
    setError(null);

    if (creating) {
      const invalid = validatePin(pin);
      if (invalid) return setError(invalid);
      if (pin !== confirm) return setError("Коды не совпадают");

      setPending(true);
      const res = await setup(pin);
      setPending(false);
      if ("error" in res) return setError(res.error);
      return setRecoveryCode(res.recoveryCode);
    }

    setPending(true);
    const err = await unlock(pin);
    setPending(false);
    if (err) return setError(err);
    onDone();
  }
}
