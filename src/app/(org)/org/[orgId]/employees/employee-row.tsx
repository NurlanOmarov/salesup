"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, MoreHorizontal } from "lucide-react";
import {
  grantSeatAction,
  resetMemberPasswordAction,
  revokeSeatAction,
  setMemberActiveAction,
  setMemberGroupAction,
} from "../../actions";
import { Button } from "@/components/ui/button";

export interface SeatInfo {
  enrollmentId: string;
  licenseId: string;
  courseTitle: string;
  expiresAt: string | null;
}

export interface EmployeeRowData {
  membershipId: string;
  login: string;
  groupId: string | null;
  isActive: boolean;
  seats: SeatInfo[];
}

interface LicenseOption {
  id: string;
  courseTitle: string;
  free: number;
}

/**
 * Строка работника с действиями. Всё, что можно сделать с сотрудником, собрано
 * в одном раскрывающемся блоке: открыть курс, закрыть курс, сбросить пароль,
 * отключить. Персональных данных здесь нет — только код вида acme-0042.
 */
export function EmployeeActions({
  orgId,
  data,
  licenses,
  groups,
}: {
  orgId: string;
  data: EmployeeRowData;
  licenses: LicenseOption[];
  groups: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reset, setReset] = useState<{ login: string; tempPassword: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const openSeats = new Set(data.seats.map((s) => s.licenseId));
  const available = licenses.filter((l) => !openSeats.has(l.id));

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setPending(true);
    setError(null);
    const res = await fn();
    setPending(false);
    if (!res.ok) setError(res.error ?? "Не получилось");
    else router.refresh();
  }

  return (
    <div className="text-right">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <MoreHorizontal className="size-4" />
      </Button>

      {open ? (
        <div className="mt-2 space-y-3 rounded-xl border border-foreground/10 bg-background p-3 text-left">
          {/* Открытые курсы */}
          <div>
            <p className="text-xs uppercase tracking-wide text-foreground/50">
              Открытые курсы
            </p>
            {data.seats.length === 0 ? (
              <p className="mt-1 text-sm text-foreground/55">Нет</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {data.seats.map((s) => (
                  <li key={s.enrollmentId} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {s.courseTitle}
                      {s.expiresAt ? (
                        <span className="text-foreground/45"> · до {s.expiresAt}</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          if (
                            !window.confirm(
                              "Закрыть доступ к курсу? Место вернётся в общий пул и его можно будет отдать другому сотруднику.",
                            )
                          ) {
                            return { ok: true };
                          }
                          return revokeSeatAction({
                            orgId,
                            enrollmentId: s.enrollmentId,
                          });
                        })
                      }
                      className="text-xs text-red-600 hover:underline"
                    >
                      закрыть
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Выдать курс */}
          {available.length > 0 ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-foreground/50">
                Открыть курс
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {available.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    disabled={pending || l.free <= 0}
                    onClick={() =>
                      run(() =>
                        grantSeatAction({
                          orgId,
                          membershipId: data.membershipId,
                          licenseId: l.id,
                        }),
                      )
                    }
                    className="rounded-lg border border-foreground/15 px-2.5 py-1 text-xs transition-colors hover:bg-foreground/5 disabled:opacity-40"
                    title={l.free <= 0 ? "Свободных мест нет" : undefined}
                  >
                    {l.courseTitle}
                    <span className="ml-1 text-foreground/45">({l.free})</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Подразделение */}
          {groups.length > 0 ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-foreground/50">
                Подразделение
              </p>
              <select
                defaultValue={data.groupId ?? ""}
                disabled={pending}
                onChange={(e) =>
                  run(() =>
                    setMemberGroupAction({
                      orgId,
                      membershipId: data.membershipId,
                      groupId: e.target.value || null,
                    }),
                  )
                }
                className="mt-1 h-9 w-full rounded-lg border border-foreground/15 bg-background px-2 text-sm"
              >
                <option value="">— не указано —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Пароль и статус */}
          <div className="flex flex-wrap gap-2 border-t border-foreground/10 pt-3">
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setError(null);
                const res = await resetMemberPasswordAction({
                  orgId,
                  membershipId: data.membershipId,
                });
                setPending(false);
                if (res.ok) setReset(res.data);
                else setError(res.error);
              }}
            >
              <KeyRound className="mr-1.5 size-4" />
              Сбросить пароль
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  if (
                    data.isActive &&
                    !window.confirm(
                      "Отключить работника? Он потеряет доступ, а его места вернутся в пул.",
                    )
                  ) {
                    return { ok: true };
                  }
                  return setMemberActiveAction({
                    orgId,
                    membershipId: data.membershipId,
                    isActive: !data.isActive,
                  });
                })
              }
            >
              {data.isActive ? "Отключить" : "Включить"}
            </Button>
          </div>

          {reset ? (
            <div className="rounded-lg border border-emerald-600/30 bg-emerald-500/5 p-3">
              <p className="text-xs text-foreground/70">
                Передайте сотруднику. Пароль показывается один раз, при входе он
                сменит его.
              </p>
              <p className="mt-1.5 font-mono text-sm">
                {reset.login} · {reset.tempPassword}
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(
                      `${reset.login} / ${reset.tempPassword}`,
                    );
                    setCopied(true);
                  }}
                  className="ml-2 align-middle text-foreground/50 hover:text-foreground"
                  aria-label="Скопировать"
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </button>
              </p>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
