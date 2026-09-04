"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import {
  grantEnrollmentAction,
  revokeEnrollmentAction,
  resetPasswordAction,
  toggleBlockAction,
  setDeviceLimitAction,
} from "../actions";
import { ACCESS_DURATIONS, ACCESS_DURATION_LABELS } from "@/lib/admin/enrollment";
import { SITE_HOSTS } from "@/lib/seo/site-hosts";
import { studentPasswordMessage } from "@/lib/messages/templates";
import { ShareMessage } from "@/components/share-message";
import { Button } from "@/components/ui/button";

/** Селект периода доступа. Пустое значение = по тарифу курса. */
function DurationSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="rounded-md border border-foreground/15 bg-background px-2 py-2 text-sm"
      aria-label="Срок доступа"
    >
      <option value="">По тарифу курса</option>
      {ACCESS_DURATIONS.map((d) => (
        <option key={d} value={d}>
          {ACCESS_DURATION_LABELS[d]}
        </option>
      ))}
    </select>
  );
}

/** Селект домена/рынка, к которому относится выдаваемый доступ (только для аналитики). */
function DomainSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="rounded-md border border-foreground/15 bg-background px-2 py-2 text-sm"
      aria-label="Домен / рынок"
    >
      {SITE_HOSTS.map((s) => (
        <option key={s.code} value={s.code}>
          {s.code}
        </option>
      ))}
    </select>
  );
}

interface EnrollmentView {
  courseId: string;
  title: string;
  status: "active" | "revoked" | "expired";
  expiresAt: string | null;
}

interface CourseOption {
  id: string;
  title: string;
}

export function EnrollmentManager({
  userId,
  enrollments,
  grantable,
  defaultSite,
}: {
  userId: string;
  enrollments: EnrollmentView[];
  grantable: CourseOption[];
  defaultSite: string;
}) {
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState("");
  const [duration, setDuration] = useState("");
  const [site, setSite] = useState(defaultSite);

  return (
    <section className="rounded-2xl border border-foreground/10 bg-background p-5">
      <h2 className="font-semibold">Доступы к курсам</h2>

      {enrollments.length === 0 ? (
        <p className="mt-3 text-sm text-foreground/50">Доступов пока нет.</p>
      ) : (
        <ul className="mt-3 divide-y divide-foreground/5">
          {enrollments.map((e) => (
            <EnrollmentRow
              key={e.courseId}
              userId={userId}
              enrollment={e}
              pending={pending}
              start={start}
              defaultSite={defaultSite}
            />
          ))}
        </ul>
      )}

      {grantable.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-foreground/10 pt-4">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          >
            <option value="">Выберите курс для выдачи…</option>
            {grantable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <DurationSelect value={duration} onChange={setDuration} disabled={pending} />
          <DomainSelect value={site} onChange={setSite} disabled={pending} />
          <Button
            variant="accent"
            size="sm"
            disabled={pending || !selected}
            onClick={() =>
              start(async () => {
                await grantEnrollmentAction({
                  userId,
                  courseId: selected,
                  accessDuration: duration || undefined,
                  site,
                });
                setSelected("");
                setDuration("");
              })
            }
          >
            Выдать
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/** Строка одного доступа: статус + отзыв (активный) или повторная выдача с выбором срока. */
function EnrollmentRow({
  userId,
  enrollment: e,
  pending,
  start,
  defaultSite,
}: {
  userId: string;
  enrollment: EnrollmentView;
  pending: boolean;
  start: (cb: () => Promise<void>) => void;
  defaultSite: string;
}) {
  const [duration, setDuration] = useState("");
  const [site, setSite] = useState(defaultSite);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2.5">
      <div>
        <p className="text-sm font-medium">{e.title}</p>
        <p className="text-xs text-foreground/50">
          {e.status === "active" && (e.expiresAt ? `до ${e.expiresAt}` : "бессрочно")}
          {e.status === "revoked" && "доступ отозван"}
          {e.status === "expired" && "срок истёк"}
        </p>
      </div>
      {e.status === "active" ? (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await revokeEnrollmentAction({ userId, courseId: e.courseId });
            })
          }
        >
          Отозвать
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <DurationSelect value={duration} onChange={setDuration} disabled={pending} />
          <DomainSelect value={site} onChange={setSite} disabled={pending} />
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await grantEnrollmentAction({
                  userId,
                  courseId: e.courseId,
                  accessDuration: duration || undefined,
                  site,
                });
              })
            }
          >
            Выдать снова
          </Button>
        </div>
      )}
    </li>
  );
}

/** Лимит одновременных устройств ученика: стандарт / безлимит / своё число. */
export function DeviceLimitForm({
  userId,
  deviceLimit,
}: {
  userId: string;
  deviceLimit: number | null;
}) {
  const initialMode: "default" | "unlimited" | "custom" =
    deviceLimit === null ? "default" : deviceLimit <= 0 ? "unlimited" : "custom";
  const [mode, setMode] = useState<"default" | "unlimited" | "custom">(initialMode);
  const [limit, setLimit] = useState<number>(deviceLimit && deviceLimit > 0 ? deviceLimit : 2);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const options: { value: typeof mode; label: string; hint: string }[] = [
    { value: "default", label: "Стандарт (2)", hint: "Лимит по умолчанию" },
    { value: "custom", label: "Своё число", hint: "Точное число устройств" },
    { value: "unlimited", label: "Безлимит", hint: "Без ограничения" },
  ];

  return (
    <section className="rounded-2xl border border-foreground/10 bg-background p-5">
      <h2 className="font-semibold">Лимит устройств</h2>
      <p className="mt-0.5 text-sm text-foreground/55">
        Сколько устройств может одновременно пользоваться аккаунтом. Новое устройство сверх лимита не пустит на вход.
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              setMode(o.value);
              setSaved(false);
            }}
            className={[
              "rounded-xl border p-3 text-left transition-colors",
              mode === o.value
                ? "border-amber-500/50 bg-amber-500/[0.07]"
                : "border-foreground/15 hover:bg-foreground/[0.03]",
            ].join(" ")}
          >
            <span className="block text-sm font-medium">{o.label}</span>
            <span className="mt-0.5 block text-xs text-foreground/50">{o.hint}</span>
          </button>
        ))}
      </div>

      {mode === "custom" ? (
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="device-limit" className="text-sm text-foreground/60">
            Устройств:
          </label>
          <input
            id="device-limit"
            type="number"
            min={1}
            max={50}
            value={limit}
            onChange={(e) => {
              setLimit(Math.max(1, Math.min(50, Number(e.target.value) || 1)));
              setSaved(false);
            }}
            className="h-10 w-24 rounded-lg border border-foreground/20 bg-background px-3 text-sm"
          />
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="accent"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await setDeviceLimitAction({
                userId,
                mode,
                ...(mode === "custom" ? { limit } : {}),
              });
              if (res.ok) setSaved(true);
            })
          }
        >
          {pending ? "Сохраняем…" : "Сохранить"}
        </Button>
        {saved ? (
          <span className="flex items-center gap-1 text-sm text-emerald-600">
            <Check className="size-4" /> Сохранено
          </span>
        ) : null}
      </div>
    </section>
  );
}

export function DangerZone({
  userId,
  blocked,
  login,
  siteUrl,
}: {
  userId: string;
  blocked: boolean;
  /** Логин ученика (e-mail или org-0042) — попадает в готовое сообщение. */
  login: string;
  siteUrl: string;
}) {
  const [pending, start] = useTransition();
  const [newPassword, setNewPassword] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border border-foreground/10 bg-background p-5">
      <h2 className="font-semibold">Управление аккаунтом</h2>

      <div className="mt-3 flex flex-wrap gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await resetPasswordAction({ userId });
              if (res.ok) setNewPassword(res.data.tempPassword);
            })
          }
        >
          Сбросить пароль
        </Button>

        <Button
          variant={blocked ? "outline" : "destructive"}
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await toggleBlockAction({ userId, blocked: !blocked });
            })
          }
        >
          {blocked ? "Разблокировать вход" : "Заблокировать вход"}
        </Button>
      </div>

      {newPassword ? (
        <div className="mt-4">
          <ShareMessage
            text={studentPasswordMessage({ login, tempPassword: newPassword, siteUrl })}
            title="Новый временный пароль"
            hint="Показывается один раз — скопируйте и отправьте ученику"
          />
        </div>
      ) : null}
    </section>
  );
}
