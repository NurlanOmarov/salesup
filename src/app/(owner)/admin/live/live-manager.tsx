"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import {
  cancelSessionAction,
  planSessionAction,
  rescheduleSessionAction,
  retryRemoteAction,
  syncResultAction,
} from "./actions";
import { LIVE_TIMEZONES, utcToZonedInput } from "@/lib/live/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Управление живыми сессиями: планирование и действия по каждой встрече. */

interface OrgOption {
  id: string;
  name: string;
}

interface CourseOption {
  id: string;
  title: string;
}

export interface SessionRow {
  id: string;
  orgId: string;
  orgName: string;
  kind: "INTRO" | "FINAL" | "EXTRA";
  title: string;
  /** ISO — форматируется на сервере, здесь нужен только для формы переноса. */
  scheduledAtIso: string;
  when: string;
  zone: string;
  timezone: string;
  durationMin: number;
  status: "PLANNED" | "LIVE" | "FINISHED" | "CANCELLED";
  joinUrl: string | null;
  remoteCreated: boolean;
  recordingReady: boolean;
  attendedCount: number | null;
  isPast: boolean;
}

const KIND_LABELS: Record<SessionRow["kind"], string> = {
  INTRO: "Вводная",
  FINAL: "Итоговая",
  EXTRA: "Дополнительная",
};

export function PlanSessionForm({
  orgs,
  courses,
}: {
  orgs: OrgOption[];
  courses: CourseOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [kind, setKind] = useState<SessionRow["kind"]>("INTRO");

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    setWarning(null);
    const res = await planSessionAction({
      orgId: formData.get("orgId"),
      kind,
      title: formData.get("title"),
      localAt: formData.get("localAt"),
      timezone: formData.get("timezone"),
      durationMin: formData.get("durationMin"),
      courseId: formData.get("courseId") || undefined,
      note: formData.get("note") || undefined,
    });
    setPending(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Встреча у нас есть всегда, а вот в SABAK могла не доехать — про это надо
    // сказать сразу, иначе владелец узнает об этом в день встречи.
    if (!res.data.remote) {
      setWarning(
        "Встреча сохранена, но в SABAK не создана — сервис недоступен. Нажмите «Повторить» в списке.",
      );
    }
    router.refresh();
  }

  if (orgs.length === 0) {
    return (
      <p className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 text-sm text-foreground/60">
        Сначала заведите организацию — встречи назначаются конкретному клиенту.
      </p>
    );
  }

  return (
    <form action={submit} className="rounded-xl border border-foreground/10 bg-background p-4">
      <p className="text-sm font-semibold">Назначить встречу</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(KIND_LABELS) as SessionRow["kind"][]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm transition-colors",
              kind === k
                ? "border-brand bg-brand/10 font-medium"
                : "border-foreground/15 text-foreground/70 hover:bg-foreground/5",
            )}
          >
            {KIND_LABELS[k]}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="orgId">Организация</Label>
          <select
            id="orgId"
            name="orgId"
            required
            className="h-10 w-full rounded-lg border border-foreground/15 bg-background px-3 text-sm"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="title">Название</Label>
          <Input
            id="title"
            name="title"
            required
            defaultValue={
              kind === "INTRO"
                ? "Вводная сессия с тренером"
                : kind === "FINAL"
                  ? "Итоговая сессия: разбор и вопросы"
                  : "Встреча с тренером"
            }
            key={kind}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="timezone">Часовой пояс клиента</Label>
          <select
            id="timezone"
            name="timezone"
            className="h-10 w-full rounded-lg border border-foreground/15 bg-background px-3 text-sm"
          >
            {LIVE_TIMEZONES.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="localAt">Дата и время (в зоне клиента)</Label>
          <Input id="localAt" name="localAt" type="datetime-local" required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="durationMin">Длительность, мин</Label>
          <Input
            id="durationMin"
            name="durationMin"
            type="number"
            min={15}
            max={480}
            step={15}
            defaultValue={60}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="courseId">Курс (необязательно)</Label>
          <select
            id="courseId"
            name="courseId"
            className="h-10 w-full rounded-lg border border-foreground/15 bg-background px-3 text-sm"
          >
            <option value="">— не привязывать —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="note">Заметка для себя</Label>
          <Input id="note" name="note" placeholder="Кто со стороны клиента, о чём договорились" />
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {warning ? <p className="mt-3 text-sm text-amber-700">{warning}</p> : null}

      <Button type="submit" disabled={pending} className="mt-4">
        {pending ? "Назначаем…" : "Назначить встречу"}
      </Button>
    </form>
  );
}

export function SessionActions({ session }: { session: SessionRow }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);

  async function run(name: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setPending(name);
    setError(null);
    const res = await fn();
    setPending(null);
    if (!res.ok) setError(res.error ?? "Не получилось");
    else router.refresh();
  }

  async function saveMove(formData: FormData) {
    await run("move", () =>
      rescheduleSessionAction({
        id: session.id,
        localAt: formData.get("localAt"),
        timezone: session.timezone,
        durationMin: formData.get("durationMin"),
      }),
    );
    setEditing(false);
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {session.joinUrl ? (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(session.joinUrl!);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="flex items-center gap-1 rounded-lg border border-foreground/15 px-2 py-1 text-xs hover:bg-foreground/5"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            Ссылка
          </button>
        ) : null}

        {!session.remoteCreated && session.status !== "CANCELLED" ? (
          <button
            type="button"
            disabled={pending === "retry"}
            onClick={() => run("retry", () => retryRemoteAction({ id: session.id }))}
            className="flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-800 hover:bg-amber-500/20"
          >
            <RotateCcw className="size-3.5" />
            Повторить в SABAK
          </button>
        ) : null}

        {session.isPast && session.remoteCreated ? (
          <button
            type="button"
            disabled={pending === "sync"}
            onClick={() => run("sync", () => syncResultAction({ id: session.id }))}
            className="flex items-center gap-1 rounded-lg border border-foreground/15 px-2 py-1 text-xs hover:bg-foreground/5"
          >
            <RefreshCw className="size-3.5" />
            Итоги
          </button>
        ) : null}

        {!session.isPast ? (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-lg border border-foreground/15 px-2 py-1 text-xs hover:bg-foreground/5"
          >
            Перенести
          </button>
        ) : null}

        <button
          type="button"
          disabled={pending === "cancel"}
          onClick={() => {
            if (!window.confirm("Отменить встречу? Клиент увидит, что её больше нет.")) return;
            void run("cancel", () => cancelSessionAction({ id: session.id }));
          }}
          className="flex items-center gap-1 rounded-lg border border-foreground/15 px-2 py-1 text-xs text-red-600 hover:bg-red-500/5"
        >
          <Trash2 className="size-3.5" />
          Отменить
        </button>
      </div>

      {editing ? (
        <form action={saveMove} className="flex flex-wrap items-end justify-end gap-2">
          <Input
            name="localAt"
            type="datetime-local"
            defaultValue={utcToZonedInput(new Date(session.scheduledAtIso), session.timezone)}
            className="h-9 w-52"
          />
          <Input
            name="durationMin"
            type="number"
            min={15}
            max={480}
            step={15}
            defaultValue={session.durationMin}
            className="h-9 w-20"
          />
          <Button type="submit" size="sm" disabled={pending === "move"}>
            Сохранить
          </Button>
        </form>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export { KIND_LABELS };
