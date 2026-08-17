"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Printer, UserPlus } from "lucide-react";
import { createMembersAction } from "../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LicenseOption {
  id: string;
  courseTitle: string;
  free: number;
}

/**
 * Создание работников пачкой — для случая «заведите нам десять человек прямо
 * сейчас», когда объяснять сотрудникам регистрацию по коду некогда.
 *
 * Основной путь всё же коды: одноразовый код бесполезен после активации, а
 * временный пароль, пройдя цепочку до сотрудника, может осесть в переписке.
 * Поэтому пароли показываются один раз и меняются при первом входе.
 */
export function CreateMembers({
  orgId,
  licenses,
  groups,
}: {
  orgId: string;
  licenses: LicenseOption[];
  groups: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ login: string; password: string }[]>([]);
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(licenses.map((l) => l.id)),
  );
  const [groupId, setGroupId] = useState("");

  // Больше, чем свободных мест по самому дефицитному из выбранных курсов, создать
  // нельзя — иначе получились бы учётки, которым нечего открыть.
  const maxBySeats = licenses
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
    const res = await createMembersAction({
      orgId,
      count: formData.get("count"),
      licenseIds: [...selected],
      groupId: groupId || undefined,
    });
    setPending(false);
    if (res.ok) {
      setCreated(res.data.members);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  if (created.length > 0) {
    const plain = created.map((m) => `${m.login}\t${m.password}`).join("\n");
    return (
      <div className="rounded-xl border border-emerald-600/30 bg-emerald-500/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-emerald-800">
            Создано учётных записей: {created.length}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(plain);
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
          Пароли показываются <strong>один раз</strong> — сохраните список сейчас.
          При первом входе каждый сотрудник сменит пароль на свой.
        </p>

        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-foreground/50">
            <tr>
              <th className="py-1.5 font-medium">Логин</th>
              <th className="py-1.5 font-medium">Временный пароль</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {created.map((m) => (
              <tr key={m.login} className="border-t border-foreground/5">
                <td className="py-1.5">{m.login}</td>
                <td className="py-1.5">{m.password}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <Button
          size="sm"
          className="mt-4"
          onClick={() => {
            setCreated([]);
            setOpen(false);
          }}
        >
          Готово
        </Button>
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <UserPlus className="mr-1.5 size-4" />
        Создать работников
      </Button>
    );
  }

  return (
    <form action={onSubmit} className="rounded-xl border border-foreground/10 bg-background p-4">
      <p className="text-sm font-semibold">Создать работников сразу</p>
      <p className="mt-1 text-sm text-foreground/60">
        Платформа выдаст логины и временные пароли — раздадите их списком. Если
        сотрудники могут зарегистрироваться сами, лучше выдать коды доступа.
      </p>

      <div className="mt-3 space-y-1.5">
        <Label>Какие курсы открыть</Label>
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="count">Сколько работников</Label>
          <Input
            id="count"
            name="count"
            type="number"
            min={1}
            max={100}
            defaultValue={5}
          />
          {Number.isFinite(maxBySeats) ? (
            <p className="text-xs text-foreground/50">
              Свободных мест по выбранным курсам: {maxBySeats}
            </p>
          ) : null}
        </div>

        {groups.length > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="memberGroup">Подразделение</Label>
            <select
              id="memberGroup"
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

      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={pending || selected.size === 0}>
          {pending ? "Создаём…" : "Создать"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
