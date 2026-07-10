"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { updateProfileAction, changeOwnPasswordAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SUBTITLE_OPTIONS = [
  { value: "", label: "Выключены" },
  { value: "RU", label: "Русский" },
  { value: "KK", label: "Қазақша" },
  { value: "EN", label: "English" },
  { value: "UZ", label: "Oʻzbekcha" },
];

export interface ProfileInitial {
  name: string;
  industry: string;
  position: string;
  subtitleLang: string;
  weeklyGoal: number;
}

export function ProfileForm({ initial }: { initial: ProfileInitial }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setSaved(false);
    setFieldErrors({});
    const res = await updateProfileAction({
      name: formData.get("name"),
      industry: formData.get("industry"),
      position: formData.get("position"),
      subtitleLang: formData.get("subtitleLang"),
      weeklyGoal: formData.get("weeklyGoal"),
    });
    setPending(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else {
      setError(res.error);
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
    }
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Имя (как в сертификате) *</Label>
        <Input id="name" name="name" defaultValue={initial.name} placeholder="Иван Петров" />
        {fieldErrors.name ? <p className="text-sm text-red-600">{fieldErrors.name[0]}</p> : null}
        <p className="text-xs text-foreground/50">
          Это имя будет напечатано в вашем сертификате.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="industry">Отрасль</Label>
          <Input id="industry" name="industry" defaultValue={initial.industry} placeholder="Туризм" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="position">Должность</Label>
          <Input id="position" name="position" defaultValue={initial.position} placeholder="Менеджер по продажам" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="subtitleLang">Язык субтитров по умолчанию</Label>
          <select
            id="subtitleLang"
            name="subtitleLang"
            defaultValue={initial.subtitleLang}
            className="h-11 w-full rounded-lg border border-foreground/20 bg-background px-3 text-sm"
          >
            {SUBTITLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="weeklyGoal">Цель: уроков в неделю</Label>
          <select
            id="weeklyGoal"
            name="weeklyGoal"
            defaultValue={String(initial.weeklyGoal)}
            className="h-11 w-full rounded-lg border border-foreground/20 bg-background px-3 text-sm"
          >
            {[1, 2, 3, 5, 7, 10, 14].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <p className="text-xs text-foreground/50">Влияет на виджет цели на дашборде.</p>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Сохраняем…" : "Сохранить"}
        </Button>
        {saved ? (
          <span className="flex items-center gap-1 text-sm text-emerald-600">
            <Check className="size-4" /> Сохранено
          </span>
        ) : null}
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setDone(false);
    const res = await changeOwnPasswordAction({
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    });
    setPending(false);
    if (res.ok) {
      setDone(true);
      (document.getElementById("password-form") as HTMLFormElement | null)?.reset();
      setTimeout(() => setDone(false), 2500);
    } else {
      setError(res.error);
    }
  }

  return (
    <form id="password-form" action={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">Текущий пароль</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="newPassword">Новый пароль</Label>
          <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Повторите новый</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" />
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Меняем…" : "Сменить пароль"}
        </Button>
        {done ? (
          <span className="flex items-center gap-1 text-sm text-emerald-600">
            <Check className="size-4" /> Пароль изменён
          </span>
        ) : null}
      </div>
    </form>
  );
}
