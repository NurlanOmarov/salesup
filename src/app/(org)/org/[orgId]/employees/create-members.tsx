"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Printer, UserPlus } from "lucide-react";
import { createMembersAction } from "../../actions";
import { orgWorkerWelcomeMessage } from "@/lib/messages/templates";
import { ShareMessage } from "@/components/share-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoginPreview } from "./login-preview";

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
  orgSlug,
  licenses,
  groups,
  siteUrl,
  orgName,
}: {
  orgId: string;
  orgSlug: string;
  licenses: LicenseOption[];
  groups: { id: string; name: string }[];
  /** Адрес входа — попадает в сообщение сотруднику вместе с логином. */
  siteUrl: string;
  orgName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ login: string; password: string }[]>([]);
  // Что именно скопировано последним кликом: список, все сообщения или строка
  // конкретного сотрудника — чтобы галочка загоралась ровно на своей кнопке.
  const [copied, setCopied] = useState<string | null>(null);
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
    try {
      const res = await createMembersAction({
        orgId,
        count: formData.get("count"),
        licenseIds: [...selected],
        groupId: groupId || undefined,
      });
      if (res.ok) {
        setCreated(res.data.members);
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

  if (created.length > 0) {
    // Курсы, которые открылись этой пачке: сотруднику важнее названия, чем id.
    const courseTitles = licenses.filter((l) => selected.has(l.id)).map((l) => l.courseTitle);
    const messageFor = (m: { login: string; password: string }) =>
      orgWorkerWelcomeMessage({
        login: m.login,
        tempPassword: m.password,
        siteUrl,
        orgName,
        courses: courseTitles,
      });
    // Табличный список — для тех, кто раздаёт доступы по своей ведомости.
    const plain = created.map((m) => `${m.login}\t${m.password}`).join("\n");

    return (
      <div className="rounded-xl border border-emerald-600/30 bg-emerald-500/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-emerald-800">
            Создано учётных записей: {created.length}
          </p>
          <div className="flex gap-2">
            {created.length > 1 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    created.map((m) => messageFor(m)).join("\n\n———\n\n"),
                  );
                  setCopied("messages");
                }}
              >
                {copied === "messages" ? (
                  <Check className="mr-1.5 size-4" />
                ) : (
                  <Copy className="mr-1.5 size-4" />
                )}
                Все сообщения
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(plain);
                setCopied("plain");
              }}
            >
              {copied === "plain" ? (
                <Check className="mr-1.5 size-4" />
              ) : (
                <Copy className="mr-1.5 size-4" />
              )}
              Только логины и пароли
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
          {created.length > 1
            ? " «Все сообщения» копирует готовые письма — по одному на человека, каждое со своим логином и адресом входа."
            : ""}
        </p>

        {created.length === 1 ? (
          <div className="mt-3">
            <ShareMessage
              text={messageFor(created[0]!)}
              title="Сообщение сотруднику"
              hint="Скопируйте и отправьте — в тексте есть адрес входа"
              rows={9}
              printable
            />
          </div>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-foreground/50">
              <tr>
                <th className="py-1.5 font-medium">Логин</th>
                <th className="py-1.5 font-medium">Временный пароль</th>
                <th className="py-1.5 font-medium" />
              </tr>
            </thead>
            <tbody className="font-mono">
              {created.map((m) => (
                <tr key={m.login} className="border-t border-foreground/5">
                  <td className="py-1.5">{m.login}</td>
                  <td className="py-1.5">{m.password}</td>
                  <td className="py-1.5 text-right">
                    <button
                      type="button"
                      title="Скопировать сообщение для этого сотрудника"
                      onClick={() => {
                        void navigator.clipboard.writeText(messageFor(m));
                        setCopied(m.login);
                      }}
                      className="text-foreground/45 hover:text-foreground"
                    >
                      {copied === m.login ? (
                        <Check className="size-4 text-emerald-600" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                      <span className="sr-only">Скопировать сообщение</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

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

      <LoginPreview orgSlug={orgSlug} />

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
