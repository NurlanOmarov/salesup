"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, MoreHorizontal, Trash2 } from "lucide-react";
import {
  deleteMemberAction,
  grantSeatAction,
  resetMemberPasswordAction,
  revokeSeatAction,
  setMemberActiveAction,
  setMemberGroupAction,
} from "../../actions";
import { orgWorkerPasswordMessage } from "@/lib/messages/templates";
import { ShareMessage } from "@/components/share-message";
import { ActionResult, useActionResult } from "@/components/action-result";
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
  siteUrl,
  orgName,
}: {
  orgId: string;
  data: EmployeeRowData;
  licenses: LicenseOption[];
  groups: { id: string; name: string }[];
  /** Адрес входа — без него сотрудник получает логин и пароль без двери. */
  siteUrl: string;
  orgName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const feedback = useActionResult();
  const [reset, setReset] = useState<{ login: string; tempPassword: string } | null>(
    null,
  );

  const openSeats = new Set(data.seats.map((s) => s.licenseId));
  const available = licenses.filter((l) => !openSeats.has(l.id));

  /**
   * Общая обёртка действий строки. `done` — что показать после успеха; без
   * него сообщения нет (например, человек отменил подтверждение и ничего не
   * произошло — рапортовать не о чем).
   */
  async function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    done?: string,
  ) {
    setPending(true);
    feedback.clear();
    const res = await fn();
    setPending(false);
    if (!res.ok) {
      feedback.fail(res.error ?? "Не получилось");
      return;
    }
    if (done) feedback.ok(done);
    router.refresh();
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
                      onClick={() => {
                        if (
                          !window.confirm(
                            "Закрыть доступ к курсу? Место вернётся в общий пул и его можно будет отдать другому сотруднику.",
                          )
                        ) {
                          return;
                        }
                        void run(
                          () =>
                            revokeSeatAction({ orgId, enrollmentId: s.enrollmentId }),
                          `Доступ к «${s.courseTitle}» закрыт, место вернулось в пул.`,
                        );
                      }}
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
                      run(
                        () =>
                          grantSeatAction({
                            orgId,
                            membershipId: data.membershipId,
                            licenseId: l.id,
                          }),
                        `Курс «${l.courseTitle}» открыт работнику ${data.login}.`,
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
                  run(
                    () =>
                      setMemberGroupAction({
                        orgId,
                        membershipId: data.membershipId,
                        groupId: e.target.value || null,
                      }),
                    e.target.value
                      ? `Подразделение изменено: ${
                          groups.find((g) => g.id === e.target.value)?.name ?? ""
                        }.`
                      : "Подразделение убрано.",
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
                feedback.clear();
                const res = await resetMemberPasswordAction({
                  orgId,
                  membershipId: data.membershipId,
                });
                setPending(false);
                // Успех виден сам: ниже разворачивается готовое сообщение с
                // новым паролем — дублировать его строкой незачем.
                if (res.ok) setReset(res.data);
                else feedback.fail(res.error);
              }}
            >
              <KeyRound className="mr-1.5 size-4" />
              Выдать пароль
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                if (
                  data.isActive &&
                  !window.confirm(
                    "Отключить работника? Он потеряет доступ, а его места вернутся в пул.",
                  )
                ) {
                  return;
                }
                void run(
                  () =>
                    setMemberActiveAction({
                      orgId,
                      membershipId: data.membershipId,
                      isActive: !data.isActive,
                    }),
                  data.isActive
                    ? `Работник ${data.login} отключён, его места вернулись в пул.`
                    : `Работник ${data.login} снова активен.`,
                );
              }}
            >
              {data.isActive ? "Отключить" : "Включить"}
            </Button>
            {/* Удаление — для ошибочно заведённой учётки. Уходящему сотруднику
                достаточно «Отключить»: там прогресс остаётся в отчётности. */}
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                if (
                  !window.confirm(
                    `Удалить учётную запись ${data.login}? Она и её результаты будут стёрты безвозвратно, место вернётся в пул. Если сотрудник просто уходит — лучше «Отключить»: тогда его прогресс останется в отчётах.`,
                  )
                ) {
                  return;
                }
                void run(
                  () => deleteMemberAction({ orgId, membershipId: data.membershipId }),
                  `Учётная запись ${data.login} удалена, место вернулось в пул.`,
                );
              }}
              className="text-red-600 hover:bg-red-600/5 hover:text-red-700"
            >
              <Trash2 className="mr-1.5 size-4" />
              Удалить
            </Button>
          </div>

          {reset ? (
            <ShareMessage
              text={orgWorkerPasswordMessage({
                login: reset.login,
                tempPassword: reset.tempPassword,
                siteUrl,
                orgName,
              })}
              title="Сообщение сотруднику"
              hint="Пароль показывается один раз — скопируйте и отправьте"
              rows={7}
            />
          ) : null}

          <ActionResult result={feedback.result} />
        </div>
      ) : null}
    </div>
  );
}
