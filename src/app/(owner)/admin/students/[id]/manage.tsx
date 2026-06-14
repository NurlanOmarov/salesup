"use client";

import { useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import {
  grantEnrollmentAction,
  revokeEnrollmentAction,
  resetPasswordAction,
  toggleBlockAction,
} from "../actions";
import { ACCESS_DURATIONS, ACCESS_DURATION_LABELS } from "@/lib/admin/enrollment";
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
}: {
  userId: string;
  enrollments: EnrollmentView[];
  grantable: CourseOption[];
}) {
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState("");
  const [duration, setDuration] = useState("");

  return (
    <section className="rounded-2xl border border-foreground/10 bg-background p-5">
      <h2 className="font-semibold">Доступы к курсам</h2>

      {enrollments.length === 0 ? (
        <p className="mt-3 text-sm text-foreground/50">Доступов пока нет.</p>
      ) : (
        <ul className="mt-3 divide-y divide-foreground/5">
          {enrollments.map((e) => (
            <EnrollmentRow key={e.courseId} userId={userId} enrollment={e} pending={pending} start={start} />
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
}: {
  userId: string;
  enrollment: EnrollmentView;
  pending: boolean;
  start: (cb: () => Promise<void>) => void;
}) {
  const [duration, setDuration] = useState("");

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

export function DangerZone({
  userId,
  blocked,
}: {
  userId: string;
  blocked: boolean;
}) {
  const [pending, start] = useTransition();
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
        <div className="mt-4 rounded-xl border border-amber-600/30 bg-amber-500/5 p-4">
          <p className="text-sm text-foreground/70">
            Новый временный пароль (показывается один раз):
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded bg-foreground/10 px-3 py-1.5 font-mono text-lg font-bold">
              {newPassword}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(newPassword);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-foreground/15 px-2.5 py-1.5 text-sm hover:bg-foreground/5"
            >
              {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
              {copied ? "Скопировано" : "Копировать"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
