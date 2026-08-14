"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Printer } from "lucide-react";
import { createInvitesAction, revokeInviteAction } from "../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LicenseOption {
  id: string;
  courseTitle: string;
  free: number;
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
}: {
  orgId: string;
  licenses: LicenseOption[];
  groups: { id: string; name: string }[];
  siteUrl: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(licenses.map((l) => l.id)),
  );
  const [groupId, setGroupId] = useState("");

  const totalFree = licenses
    .filter((l) => selected.has(l.id))
    .reduce((min, l) => Math.min(min, l.free), Number.POSITIVE_INFINITY);

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
    const res = await createInvitesAction({
      orgId,
      licenseIds: [...selected],
      groupId: groupId || undefined,
      count: formData.get("count"),
      maxUses: 1,
      expiresInDays: formData.get("expiresInDays") || undefined,
    });
    setPending(false);
    if (res.ok) {
      setCodes(res.data.codes);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  const joinUrl = `${siteUrl}/join`;

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
            <Input id="count" name="count" type="number" min={1} max={200} defaultValue={5} />
            {Number.isFinite(totalFree) ? (
              <p className="text-xs text-foreground/50">
                Свободных мест по выбранным курсам: {totalFree}
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

        <Button type="submit" className="mt-4" disabled={pending || selected.size === 0}>
          {pending ? "Создаём…" : "Создать коды"}
        </Button>
        <p className="mt-2 text-xs text-foreground/50">
          Каждый код одноразовый: по нему регистрируется ровно один сотрудник.
        </p>
      </form>

      {codes.length > 0 ? (
        <div className="rounded-xl border border-emerald-600/30 bg-emerald-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-emerald-800">
              Готово: {codes.length} {codes.length === 1 ? "код" : "кодов"}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    codes.map((c) => `${c} — ${joinUrl}`).join("\n"),
                  );
                  setCopied(true);
                }}
              >
                {copied ? <Check className="mr-1.5 size-4" /> : <Copy className="mr-1.5 size-4" />}
                Скопировать
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="mr-1.5 size-4" />
                Печать
              </Button>
            </div>
          </div>

          <p className="mt-2 text-sm text-foreground/70">
            Раздайте сотрудникам код и адрес{" "}
            <span className="font-mono text-foreground/90">{joinUrl}</span>. Коды
            показываются полностью только сейчас — позже в списке будет видна лишь
            их часть.
          </p>

          <ul className="mt-3 grid gap-1.5 font-mono text-sm sm:grid-cols-3">
            {codes.map((c) => (
              <li key={c} className="rounded-lg border border-foreground/10 bg-background px-3 py-2">
                {c}
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

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (!window.confirm("Отозвать код? По нему больше нельзя будет зарегистрироваться.")) return;
        setPending(true);
        const res = await revokeInviteAction({ orgId, inviteId });
        setPending(false);
        if (res.ok) router.refresh();
      }}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      отозвать
    </button>
  );
}
