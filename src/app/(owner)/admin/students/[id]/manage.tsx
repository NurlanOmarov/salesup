"use client";

import { useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import {
  grantEnrollmentAction,
  revokeEnrollmentAction,
  resetPasswordAction,
  toggleBlockAction,
} from "../actions";
import { Button } from "@/components/ui/button";

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

  return (
    <section className="rounded-2xl border border-foreground/10 bg-background p-5">
      <h2 className="font-semibold">Доступы к курсам</h2>

      {enrollments.length === 0 ? (
        <p className="mt-3 text-sm text-foreground/50">Доступов пока нет.</p>
      ) : (
        <ul className="mt-3 divide-y divide-foreground/5">
          {enrollments.map((e) => (
            <li key={e.courseId} className="flex items-center justify-between gap-3 py-2.5">
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
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await grantEnrollmentAction({ userId, courseId: e.courseId });
                    })
                  }
                >
                  Выдать снова
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {grantable.length > 0 ? (
        <div className="mt-4 flex items-center gap-2 border-t border-foreground/10 pt-4">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          >
            <option value="">Выберите курс для выдачи…</option>
            {grantable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <Button
            variant="accent"
            size="sm"
            disabled={pending || !selected}
            onClick={() =>
              start(async () => {
                await grantEnrollmentAction({ userId, courseId: selected });
                setSelected("");
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
