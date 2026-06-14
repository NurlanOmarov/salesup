"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { createStudentAction } from "../actions";
import { ACCESS_DURATIONS, ACCESS_DURATION_LABELS } from "@/lib/admin/enrollment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CourseOption {
  id: string;
  title: string;
  industry: string | null;
}

interface Created {
  email: string;
  tempPassword: string;
  studentId: string;
}

export function CreateStudentForm({
  courses,
  defaultName,
  defaultEmail,
}: {
  courses: CourseOption[];
  defaultName?: string;
  defaultEmail?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [accessDuration, setAccessDuration] = useState("");

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setFieldErrors({});
    const res = await createStudentAction({
      email: formData.get("email"),
      name: formData.get("name"),
      phone: formData.get("phone"),
      industry: formData.get("industry"),
      courseIds: Array.from(selected),
      accessDuration: accessDuration || undefined,
    });
    setPending(false);
    if (res.ok) {
      setCreated(res.data);
    } else {
      setError(res.error);
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
    }
  }

  // ── Экран успеха: показываем пароль ОДИН раз ──────────────────────────────
  if (created) {
    return (
      <div className="max-w-lg rounded-2xl border border-emerald-600/30 bg-emerald-500/5 p-6">
        <div className="flex items-center gap-2 text-emerald-700">
          <Check className="size-5" />
          <p className="font-semibold">Ученик создан</p>
        </div>
        <p className="mt-3 text-sm text-foreground/70">
          Передайте эти данные ученику. Пароль показывается{" "}
          <strong>один раз</strong> — при первом входе ученик сменит его.
        </p>

        <dl className="mt-4 space-y-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-foreground/50">Логин</dt>
            <dd className="font-mono text-sm">{created.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-foreground/50">Временный пароль</dt>
            <dd className="flex items-center gap-2">
              <code className="rounded bg-foreground/10 px-3 py-1.5 font-mono text-lg font-bold tracking-wide">
                {created.tempPassword}
              </code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    `Логин: ${created.email}\nПароль: ${created.tempPassword}`,
                  );
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-foreground/15 px-2.5 py-1.5 text-sm transition-colors hover:bg-foreground/5"
              >
                {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                {copied ? "Скопировано" : "Копировать"}
              </button>
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex gap-3">
          <Link
            href={`/admin/students/${created.studentId}`}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
          >
            Открыть карточку
          </Link>
          <Link
            href="/admin/students/new"
            className="rounded-lg border border-foreground/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/5"
          >
            Создать ещё
          </Link>
        </div>
      </div>
    );
  }

  // ── Форма ────────────────────────────────────────────────────────────────
  return (
    <form action={onSubmit} className="max-w-lg space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">Имя (как в сертификате) *</Label>
        <Input id="name" name="name" placeholder="Иван Петров" defaultValue={defaultName} />
        {fieldErrors.name ? <p className="text-sm text-red-600">{fieldErrors.name[0]}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail (логин) *</Label>
        <Input id="email" name="email" type="email" placeholder="student@example.kz" defaultValue={defaultEmail} />
        {fieldErrors.email ? <p className="text-sm text-red-600">{fieldErrors.email[0]}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Телефон</Label>
          <Input id="phone" name="phone" placeholder="+7 700 000 00 00" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="industry">Отрасль</Label>
          <Input id="industry" name="industry" placeholder="Туризм" />
        </div>
      </div>

      {courses.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Выдать доступ к курсам</legend>
          <div className="space-y-1.5 rounded-xl border border-foreground/10 p-3">
            {courses.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-foreground/5">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="size-4 accent-amber-500"
                />
                <span className="text-sm">{c.title}</span>
                {c.industry ? (
                  <span className="ml-auto text-xs text-foreground/40">{c.industry}</span>
                ) : null}
              </label>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="accessDuration">Срок доступа</Label>
            <select
              id="accessDuration"
              value={accessDuration}
              onChange={(e) => setAccessDuration(e.target.value)}
              className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
            >
              <option value="">По тарифу курса</option>
              {ACCESS_DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {ACCESS_DURATION_LABELS[d]}
                </option>
              ))}
            </select>
            <p className="text-xs text-foreground/40">
              Применяется ко всем выбранным курсам. Отсчёт — с момента создания.
            </p>
          </div>
        </fieldset>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button type="submit" variant="accent" size="lg" disabled={pending}>
        {pending ? "Создаём…" : "Создать и выдать доступ"}
      </Button>
    </form>
  );
}
