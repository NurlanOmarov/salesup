"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Printer } from "lucide-react";
import {
  createInvitesAction,
  deleteInviteAction,
  purgeInvitesAction,
  revokeInviteAction,
} from "../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maskInviteCode } from "@/lib/org/seats";
import { inviteMessage } from "@/lib/messages/templates";
import { ShareMessage } from "@/components/share-message";

interface LicenseOption {
  id: string;
  courseTitle: string;
  /** Мест не занято работниками. */
  free: number;
  /** Из них уже обещано действующими кодами, которые пока не активировали. */
  reserved: number;
}

/**
 * Создание кодов самозаписи. Коды раздаёт клиент своими средствами — платформа
 * не знает, кому именно, и в этом весь смысл: работник регистрируется сам,
 * без передачи нам персональных данных.
 */
export function InvitesManager({
  orgId,
  licenses,
  groups,
  siteUrl,
  orgName,
}: {
  orgId: string;
  licenses: LicenseOption[];
  groups: { id: string; name: string }[];
  siteUrl: string;
  /** Наименование клиента — с него начинается сообщение сотруднику. */
  orgName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  // Что именно скопировано последним кликом: список кодов, все сообщения или
  // сообщение конкретного кода — чтобы галочка загоралась ровно на своей кнопке.
  const [copied, setCopied] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(licenses.map((l) => l.id)),
  );
  const [groupId, setGroupId] = useState("");
  const [count, setCount] = useState(1);

  // Место списывается при активации кода, но обещано оно уже в момент выпуска:
  // печатать 5 кодов на одно свободное место значит отправить четверых
  // работников в ошибку на странице регистрации.
  const chosen = licenses.filter((l) => selected.has(l.id));
  const totalFree = chosen.reduce((min, l) => Math.min(min, l.free), Number.POSITIVE_INFINITY);
  const totalReserved = chosen.reduce((max, l) => Math.max(max, l.reserved), 0);
  const available = chosen.reduce(
    (min, l) => Math.min(min, Math.max(0, l.free - l.reserved)),
    Number.POSITIVE_INFINITY,
  );
  const limit = Number.isFinite(available) ? available : 0;
  const overLimit = count > limit;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setCodes([]);
    try {
      const res = await createInvitesAction({
        orgId,
        licenseIds: [...selected],
        groupId: groupId || undefined,
        count,
        maxUses: 1,
        expiresInDays: formData.get("expiresInDays") || undefined,
      });
      if (res.ok) {
        setCodes(res.data.codes);
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Не удалось отправить форму — обновите страницу и попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  const joinUrl = `${siteUrl}/join`;

  const messageFor = (code: string) => inviteMessage({ code, siteUrl, orgName });

  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text).then(
      () => {
        setCopied(key);
        window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 2500);
      },
      () => setError("Браузер не дал скопировать — выделите текст вручную."),
    );
  }

  return (
    <div className="space-y-6">
      <form action={onSubmit} className="rounded-xl border border-foreground/10 bg-background p-4">
        <h2 className="text-sm font-semibold">Создать коды</h2>

        <div className="mt-3 space-y-1.5">
          <Label>Какие курсы откроются по коду</Label>
          {licenses.length === 0 ? (
            <p className="text-sm text-foreground/55">
              Нет доступных лицензий — свяжитесь с нами, чтобы добавить курсы.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {licenses.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggle(l.id)}
                  className={
                    selected.has(l.id)
                      ? "rounded-lg border border-amber-500 bg-amber-500/10 px-3 py-1.5 text-sm"
                      : "rounded-lg border border-foreground/15 px-3 py-1.5 text-sm text-foreground/70"
                  }
                >
                  {l.courseTitle}
                  <span className="ml-1.5 text-xs text-foreground/50">
                    свободно {l.free}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="count">Сколько кодов</Label>
            <Input
              id="count"
              name="count"
              type="number"
              min={1}
              max={Math.max(1, limit)}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
            {Number.isFinite(totalFree) ? (
              <p className={overLimit ? "text-xs text-amber-700" : "text-xs text-foreground/50"}>
                Можно создать кодов: {limit}
                {totalReserved > 0
                  ? ` (свободных мест ${totalFree}, из них обещано выданными кодами ${totalReserved})`
                  : ` — столько свободных мест по выбранным курсам`}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expiresInDays">Срок действия кода, дней</Label>
            <Input
              id="expiresInDays"
              name="expiresInDays"
              type="number"
              min={1}
              max={365}
              placeholder="без ограничения"
            />
          </div>

          {groups.length > 0 ? (
            <div className="space-y-1.5">
              <Label htmlFor="groupId">Подразделение</Label>
              <select
                id="groupId"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="h-10 w-full rounded-lg border border-foreground/15 bg-background px-3 text-sm"
              >
                <option value="">— не указывать —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <Button
          type="submit"
          className="mt-4"
          disabled={pending || selected.size === 0 || limit === 0 || overLimit}
        >
          {pending ? "Создаём…" : "Создать коды"}
        </Button>
        <p className="mt-2 text-xs text-foreground/50">
          {limit === 0
            ? "Свободных мест не осталось: все заняты работниками или обещаны выданными кодами. Отзовите ненужные коды или напишите нам, чтобы добавить места."
            : overLimit
              ? `Мест хватает только на ${limit} ${limit === 1 ? "код" : "кода(ов)"} — уменьшите количество.`
              : "Каждый код одноразовый: по нему регистрируется ровно один сотрудник."}
        </p>
      </form>

      {codes.length > 0 ? (
        <div className="rounded-xl border border-emerald-600/30 bg-emerald-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-emerald-800">
              Готово: {codes.length} {codes.length === 1 ? "код" : "кодов"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  copy(codes.map((c) => messageFor(c)).join("\n\n"), "messages")
                }
              >
                {copied === "messages" ? (
                  <Check className="mr-1.5 size-4" />
                ) : (
                  <Copy className="mr-1.5 size-4" />
                )}
                Текст для рассылки
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy(codes.map((c) => `${c} — ${joinUrl}`).join("\n"), "codes")}
              >
                {copied === "codes" ? (
                  <Check className="mr-1.5 size-4" />
                ) : (
                  <Copy className="mr-1.5 size-4" />
                )}
                Только коды
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="mr-1.5 size-4" />
                Печать
              </Button>
            </div>
          </div>

          <p className="mt-2 text-sm text-foreground/70">
            «Текст для рассылки» копирует готовые сообщения — по одному на код,
            каждое с адресом и инструкцией. Отправьте каждому сотруднику своё:
            код одноразовый. Коды показываются полностью только сейчас — позже в
            списке будет видна лишь их часть.
          </p>

          {codes.length === 1 ? (
            <div className="mt-3">
              <ShareMessage
                text={messageFor(codes[0]!)}
                title="Сообщение сотруднику"
                hint="Скопируйте и отправьте тому, кому предназначен код"
                printable
              />
            </div>
          ) : null}

          <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-3">
            {codes.map((c) => (
              <li
                key={c}
                className="flex items-center justify-between gap-2 rounded-lg border border-foreground/10 bg-background px-3 py-2"
              >
                <span className="font-mono">{c}</span>
                <button
                  type="button"
                  onClick={() => copy(messageFor(c), c)}
                  title="Скопировать сообщение для сотрудника"
                  className="shrink-0 text-foreground/45 hover:text-foreground"
                >
                  {copied === c ? (
                    <Check className="size-4 text-emerald-600" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  <span className="sr-only">Скопировать сообщение</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Кнопка отзыва неиспользованного кода. */
export function RevokeInviteButton({
  orgId,
  inviteId,
}: {
  orgId: string;
  inviteId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (!window.confirm("Отозвать код? По нему больше нельзя будет зарегистрироваться.")) return;
          setPending(true);
          setError(null);
          try {
            const res = await revokeInviteAction({ orgId, inviteId });
            if (res.ok) router.refresh();
            else setError(res.error);
          } catch {
            setError("Не удалось отправить — попробуйте ещё раз.");
          } finally {
            setPending(false);
          }
        }}
        className="text-xs text-red-600 hover:underline disabled:opacity-50"
      >
        отозвать
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}

/**
 * Удаление кода из списка. Отзыв гасит код, но строка остаётся — а список из
 * десятка мёртвых кодов мешает найти живой. Кнопка появляется только у кодов,
 * по которым никто не зарегистрировался: остальные удалить нельзя.
 */
export function DeleteInviteButton({
  orgId,
  inviteId,
}: {
  orgId: string;
  inviteId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (!window.confirm("Удалить код из списка? Отменить это нельзя.")) return;
          setPending(true);
          setError(null);
          try {
            const res = await deleteInviteAction({ orgId, inviteId });
            if (res.ok) router.refresh();
            else setError(res.error);
          } catch {
            setError("Не удалось отправить — попробуйте ещё раз.");
          } finally {
            setPending(false);
          }
        }}
        className="text-xs text-foreground/45 hover:text-foreground hover:underline disabled:opacity-50"
      >
        удалить
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}

/** Разовая уборка: убрать все отозванные и истёкшие коды, которыми не воспользовались. */
export function PurgeInvitesButton({ orgId, count }: { orgId: string; count: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={async () => {
          if (
            !window.confirm(
              `Удалить недействующие коды (${count})? Действующие коды останутся.`,
            )
          )
            return;
          setPending(true);
          setError(null);
          try {
            const res = await purgeInvitesAction({ orgId });
            if (res.ok) router.refresh();
            else setError(res.error);
          } catch {
            setError("Не удалось отправить — попробуйте ещё раз.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Удаляем…" : `Удалить недействующие (${count})`}
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}

/**
 * Код в списке выданных: по умолчанию под маской, целиком — по клику.
 * Работник теряет код регулярно (переслали в чате и потеряли), а отзывать и
 * выдавать новый ради этого незачем — код лежит в базе как есть. Маска нужна
 * лишь от случайного взгляда через плечо и от скриншота всего списка.
 */
export function InviteCodeCell({
  code,
  siteUrl,
  orgName,
  usable,
}: {
  code: string;
  siteUrl: string;
  orgName: string;
  usable: boolean;
}) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!usable) return <span className="font-mono">{maskInviteCode(code)}</span>;

  if (!shown) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="font-mono">{maskInviteCode(code)}</span>
        <button
          type="button"
          onClick={() => setShown(true)}
          className="text-xs text-foreground/50 hover:text-foreground hover:underline"
        >
          показать
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono">{code}</span>
      <button
        type="button"
        title="Скопировать сообщение для сотрудника"
        onClick={() => {
          void navigator.clipboard.writeText(inviteMessage({ code, siteUrl, orgName })).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2500);
          });
        }}
        className="text-foreground/45 hover:text-foreground"
      >
        {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
        <span className="sr-only">Скопировать сообщение</span>
      </button>
    </span>
  );
}
