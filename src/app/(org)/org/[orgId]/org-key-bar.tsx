"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Eye, EyeOff, Lock, LockOpen, ShieldCheck } from "lucide-react";
import { validatePassphrase } from "@/lib/org/crypto";
import { useOrgKey } from "./org-key-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Полоска управления шифрованием меток. Три состояния:
 *  • не настроено — предложение включить (генерация ключа + recovery-код);
 *  • закрыто — поле ввода фразы;
 *  • открыто — метки видны, есть кнопка «скрыть».
 *
 * Тон нарочно спокойный: кабинет полностью работает и без ключа, метки — удобство,
 * а не условие работы.
 */
export function OrgKeyBar() {
  const { status } = useOrgKey();

  if (status === "not-configured") return <SetupCard />;
  if (status === "locked") return <UnlockCard />;
  return <UnlockedBar />;
}

function SetupCard() {
  const router = useRouter();
  const { setup } = useOrgKey();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [ack, setAck] = useState(false);

  if (recoveryCode) {
    return (
      <div className="rounded-xl border border-emerald-600/30 bg-emerald-500/5 p-4">
        <p className="flex items-center gap-2 font-semibold text-emerald-800">
          <ShieldCheck className="size-5" />
          Шифрование включено
        </p>
        <p className="mt-2 text-sm text-foreground/75">
          Сохраните код восстановления. Он показывается{" "}
          <strong>один раз</strong> и остаётся единственным способом вернуть метки,
          если парольная фраза будет забыта. Мы его не храним и восстановить не сможем.
        </p>
        <p className="mt-3 rounded-lg border border-foreground/10 bg-background px-4 py-3 text-center font-mono text-lg tracking-wider">
          {recoveryCode}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(recoveryCode);
              setCopied(true);
            }}
          >
            {copied ? <Check className="mr-1.5 size-4" /> : <Copy className="mr-1.5 size-4" />}
            Скопировать
          </Button>
          <label className="flex items-center gap-2 text-sm text-foreground/70">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="size-4"
            />
            Записал в надёжном месте
          </label>
          <Button
            size="sm"
            disabled={!ack}
            onClick={() => {
              setRecoveryCode(null);
              router.refresh();
            }}
          >
            Готово
          </Button>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-background p-4">
        <div className="flex items-start gap-2.5">
          <Lock className="mt-0.5 size-4 shrink-0 text-foreground/40" />
          <div>
            <p className="text-sm font-medium">Сотрудники видны по кодам</p>
            <p className="text-sm text-foreground/60">
              Можно добавить подписи вида «Иванова, отдел Минск» — они будут
              зашифрованы в вашем браузере, и мы не сможем их прочитать.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Включить подписи
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-foreground/10 bg-background p-4">
      <p className="text-sm font-semibold">Придумайте парольную фразу</p>
      <p className="mt-1 text-sm text-foreground/60">
        Ею шифруются подписи сотрудников. Фраза не передаётся нам — восстановить её
        мы не сможем, поэтому сразу после включения сохраните код восстановления.
      </p>

      <div className="mt-3 grid max-w-lg gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="passphrase">Фраза</Label>
          <Input
            id="passphrase"
            type="password"
            autoComplete="new-password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="не короче 10 символов"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="passphrase2">Повторите</Label>
          <Input
            id="passphrase2"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
      </div>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={async () => {
            const invalid = validatePassphrase(passphrase);
            if (invalid) return setError(invalid);
            if (passphrase !== confirm) return setError("Фразы не совпадают");

            setPending(true);
            setError(null);
            const res = await setup(passphrase);
            setPending(false);
            if ("error" in res) setError(res.error);
            else setRecoveryCode(res.recoveryCode);
          }}
        >
          {pending ? "Включаем…" : "Включить"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Отмена
        </Button>
      </div>
    </div>
  );
}

function UnlockCard() {
  const { unlock } = useOrgKey();
  const [secret, setSecret] = useState("");
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-xl border border-foreground/10 bg-background p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const err = await unlock(secret);
        setPending(false);
        if (err) setError(err);
        else setSecret("");
      }}
    >
      <div className="min-w-56 flex-1 space-y-1.5">
        <Label htmlFor="org-key-secret">
          Парольная фраза, чтобы видеть подписи сотрудников
        </Label>
        <div className="relative">
          <Input
            id="org-key-secret"
            type={show ? "text" : "password"}
            autoComplete="off"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="фраза или код восстановления"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Скрыть" : "Показать"}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        <LockOpen className="mr-1.5 size-4" />
        {pending ? "Проверяем…" : "Показать подписи"}
      </Button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
      <p className="w-full text-xs text-foreground/50">
        Без фразы кабинет работает как обычно — сотрудники показываются по кодам.
      </p>
    </form>
  );
}

function UnlockedBar() {
  const { lock } = useOrgKey();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-600/25 bg-emerald-500/[0.06] p-3">
      <p className="flex items-center gap-2 text-sm text-emerald-900">
        <ShieldCheck className="size-4" />
        Подписи расшифрованы в этой вкладке. Закроете её — снова понадобится фраза.
      </p>
      <Button variant="ghost" size="sm" onClick={lock}>
        <Lock className="mr-1.5 size-4" />
        Скрыть
      </Button>
    </div>
  );
}
