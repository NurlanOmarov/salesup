"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Pause, Play } from "lucide-react";
import {
  createOrgAdminAction,
  grantLibraryAction,
  grantLicenseAction,
  setOrgStatusAction,
  updateOrgAction,
} from "../actions";
import { ACCESS_DURATIONS, ACCESS_DURATION_LABELS } from "@/lib/admin/enrollment";
import { MIN_B2B_SEATS, quoteSeats, SUBSCRIPTION_YEAR_TIYN } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Управляющие блоки карточки организации: статус, лицензии, ответственные, реквизиты. */

interface CourseOption {
  id: string;
  title: string;
  priceTiyn: number;
}

interface LicenseValue {
  courseId: string;
  seatsTotal: number;
  accessDuration: string;
}

// ─────────────────────────── Статус организации ───────────────────────────

export function OrgStatusActions({
  orgId,
  status,
}: {
  orgId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: "ACTIVE" | "SUSPENDED" | "ARCHIVED") {
    const confirmText =
      next === "SUSPENDED"
        ? "Приостановить доступ? Все работники организации потеряют доступ к урокам до возобновления."
        : next === "ARCHIVED"
          ? "Отправить в архив? Доступ работников будет прекращён."
          : "Возобновить доступ работникам организации?";
    if (!window.confirm(confirmText)) return;

    setPending(true);
    setError(null);
    const res = await setOrgStatusAction({ orgId, status: next });
    setPending(false);
    if (res.ok) router.refresh();
    else setError(res.error);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "ACTIVE" ? (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => change("SUSPENDED")}
        >
          <Pause className="mr-1.5 size-4" />
          Приостановить
        </Button>
      ) : (
        <Button size="sm" disabled={pending} onClick={() => change("ACTIVE")}>
          <Play className="mr-1.5 size-4" />
          Возобновить
        </Button>
      )}
      {status !== "ARCHIVED" ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => change("ARCHIVED")}
        >
          В архив
        </Button>
      ) : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}

// ─────────────────────────── Лицензии ───────────────────────────

export function LicenseForm({
  orgId,
  courses,
  existing,
}: {
  orgId: string;
  courses: CourseOption[];
  existing: LicenseValue[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"course" | "library">("course");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [accessDuration, setAccessDuration] = useState("MONTHS_12");
  const [seats, setSeats] = useState("10");

  const current = existing.find((l) => l.courseId === courseId);
  const seatCount = Number(seats) || 0;

  // Что покупает клиент: конкретный курс или годовой доступ ко всей библиотеке.
  const retailTiyn =
    mode === "library"
      ? SUBSCRIPTION_YEAR_TIYN
      : (courses.find((c) => c.id === courseId)?.priceTiyn ?? 0);
  const quote = quoteSeats(seatCount, retailTiyn);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const priceByn = formData.get("priceByn");
    const priceTiyn = priceByn ? Math.round(Number(priceByn) * 100) : undefined;

    const res =
      mode === "library"
        ? await grantLibraryAction({
            orgId,
            seatsTotal: formData.get("seatsTotal"),
            accessDuration,
            pricePerSeatTiyn: priceTiyn,
            note: formData.get("note") || undefined,
          })
        : await grantLicenseAction({
            orgId,
            courseId,
            seatsTotal: formData.get("seatsTotal"),
            accessDuration,
            priceTiyn,
            note: formData.get("note") || undefined,
          });
    setPending(false);
    if (res.ok) {
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  if (courses.length === 0) {
    return (
      <p className="text-sm text-foreground/55">
        Нет опубликованных курсов — сначала опубликуйте курс.
      </p>
    );
  }

  return (
    <form action={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="button"
          onClick={() => setMode("course")}
          className={
            mode === "course"
              ? "rounded-lg border border-amber-500 bg-amber-500/10 px-3 py-1.5 text-sm font-medium"
              : "rounded-lg border border-foreground/15 px-3 py-1.5 text-sm text-foreground/70"
          }
        >
          Один курс
        </button>
        <button
          type="button"
          onClick={() => setMode("library")}
          className={
            mode === "library"
              ? "rounded-lg border border-amber-500 bg-amber-500/10 px-3 py-1.5 text-sm font-medium"
              : "rounded-lg border border-foreground/15 px-3 py-1.5 text-sm text-foreground/70"
          }
        >
          Вся библиотека ({courses.length})
        </button>
      </div>

      {mode === "course" ? (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="courseId">Курс</Label>
          <select
            id="courseId"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="h-10 w-full rounded-lg border border-foreground/15 bg-background px-3 text-sm"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} — {c.priceTiyn / 100} Br
              </option>
            ))}
          </select>
          {current ? (
            <p className="text-xs text-amber-700">
              Лицензия на этот курс уже есть ({current.seatsTotal} мест) — форма изменит
              её, а не создаст вторую. Дата начала срока сохранится.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-foreground/60 sm:col-span-2">
          Лицензии будут выданы на все {courses.length} опубликованных курсов с
          одинаковым числом мест и сроком. Цена места записывается один раз — в
          первую лицензию, чтобы выручка не посчиталась кратно числу курсов.
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="seatsTotal">Мест</Label>
        <Input
          id="seatsTotal"
          name="seatsTotal"
          type="number"
          min={1}
          required
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="accessDuration">Срок доступа</Label>
        <select
          id="accessDuration"
          value={accessDuration}
          onChange={(e) => setAccessDuration(e.target.value)}
          className="h-10 w-full rounded-lg border border-foreground/15 bg-background px-3 text-sm"
        >
          {ACCESS_DURATIONS.map((d) => (
            <option key={d} value={d}>
              {ACCESS_DURATION_LABELS[d]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="priceByn">Цена места, BYN</Label>
        <Input
          id="priceByn"
          name="priceByn"
          type="number"
          min={0}
          step="0.01"
          key={quote.pricePerSeatTiyn}
          defaultValue={
            quote.pricePerSeatTiyn > 0 ? quote.pricePerSeatTiyn / 100 : undefined
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">Счёт / примечание</Label>
        <Input id="note" name="note" placeholder="Счёт №12 от 14.08" />
      </div>

      {/* Расчёт по корпоративной сетке (docs/PRICING-PLAN.md §8) — чтобы цена в
          счёте не придумывалась каждый раз заново. Поле выше можно перебить руками. */}
      {retailTiyn > 0 && seatCount > 0 ? (
        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3 text-sm sm:col-span-2">
          {quote.tier ? (
            <p>
              <span className="font-medium">{quote.tier.label}</span> ·{" "}
              {seatCount} мест · скидка {Math.round(quote.discount * 100)} % →{" "}
              <span className="font-semibold">{quote.pricePerSeatTiyn / 100} Br</span> за
              место, итого{" "}
              <span className="font-semibold">{quote.totalTiyn / 100} Br</span> в год
              <span className="text-foreground/50">
                {" "}
                (экономия {quote.savingTiyn / 100} Br)
              </span>
            </p>
          ) : (
            <p className="text-amber-700">
              Меньше {MIN_B2B_SEATS} мест — корпоративная скидка не применяется.
              Такой объём выгоднее продать в розницу: {retailTiyn / 100} Br за место.
            </p>
          )}
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600 sm:col-span-2">{error}</p>
      ) : null}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Сохраняем…"
            : mode === "library"
              ? "Выдать все курсы"
              : current
                ? "Изменить лицензию"
                : "Выдать лицензию"}
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────── Ответственный представитель ───────────────────────────

export function OrgAdminForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const res = await createOrgAdminAction({
      orgId,
      email: formData.get("email"),
      name: formData.get("name") || undefined,
    });
    setPending(false);
    if (res.ok) {
      setCreated({ email: res.data.email, tempPassword: res.data.tempPassword });
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  if (created) {
    return (
      <div className="rounded-xl border border-emerald-600/30 bg-emerald-500/5 p-4">
        <div className="flex items-center gap-2 text-emerald-700">
          <Check className="size-5" />
          <p className="font-semibold">Ответственный назначен</p>
        </div>
        <p className="mt-2 text-sm text-foreground/70">
          Передайте данные лично. Пароль показывается <strong>один раз</strong>: при
          первом входе он будет заменён.
        </p>
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-foreground/50">Логин</dt>
            <dd className="font-mono">{created.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-foreground/50">
              Временный пароль
            </dt>
            <dd className="flex items-center gap-2 font-mono">
              {created.tempPassword}
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(created.tempPassword);
                  setCopied(true);
                }}
                className="rounded p-1 text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground"
                aria-label="Скопировать пароль"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </button>
            </dd>
          </div>
        </dl>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => setCreated(null)}
        >
          Готово
        </Button>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="grid max-w-lg gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="admin-email">E-mail *</Label>
        <Input id="admin-email" name="email" type="email" required placeholder="hr@company.by" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="admin-name">Имя (необязательно)</Label>
        <Input id="admin-name" name="name" placeholder="Для обращения в письмах" />
      </div>
      {error ? <p className="text-sm text-red-600 sm:col-span-2">{error}</p> : null}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          <KeyRound className="mr-1.5 size-4" />
          {pending ? "Создаём…" : "Назначить ответственного"}
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────── Реквизиты ───────────────────────────

export function OrgDetailsForm({
  org,
}: {
  org: {
    id: string;
    name: string;
    unp: string | null;
    contactEmail: string | null;
    contactNote: string | null;
    note: string | null;
  };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setSaved(false);
    const res = await updateOrgAction({
      orgId: org.id,
      name: formData.get("name"),
      unp: formData.get("unp") || undefined,
      contactEmail: formData.get("contactEmail") || undefined,
      contactNote: formData.get("contactNote") || undefined,
      note: formData.get("note") || undefined,
    });
    setPending(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  return (
    <form action={onSubmit} className="grid max-w-2xl gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="org-name">Наименование</Label>
        <Input id="org-name" name="name" defaultValue={org.name} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="org-unp">УНП</Label>
        <Input id="org-unp" name="unp" defaultValue={org.unp ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="org-email">E-mail ответственного</Label>
        <Input
          id="org-email"
          name="contactEmail"
          type="email"
          defaultValue={org.contactEmail ?? ""}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="org-contact">Другой контакт</Label>
        <Input id="org-contact" name="contactNote" defaultValue={org.contactNote ?? ""} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="org-note">Заметка</Label>
        <Input id="org-note" name="note" defaultValue={org.note ?? ""} />
      </div>
      {error ? <p className="text-sm text-red-600 sm:col-span-2">{error}</p> : null}
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Сохраняем…" : "Сохранить"}
        </Button>
        {saved ? <span className="text-sm text-emerald-700">Сохранено</span> : null}
      </div>
    </form>
  );
}
