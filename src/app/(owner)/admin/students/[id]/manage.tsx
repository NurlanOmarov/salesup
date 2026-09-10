"use client";

import { useState, useTransition } from "react";
import {
  grantEnrollmentAction,
  revokeEnrollmentAction,
  setEnrollmentDemoAction,
  resetPasswordAction,
  toggleBlockAction,
  setDeviceLimitAction,
  resetDevicesAction,
} from "../actions";
import { ACCESS_DURATIONS, ACCESS_DURATION_LABELS } from "@/lib/admin/enrollment";
import { SITE_HOSTS } from "@/lib/seo/site-hosts";
import { studentPasswordMessage } from "@/lib/messages/templates";
import { ShareMessage } from "@/components/share-message";
import {
  DEVICE_FLAG_NOTE,
  DeviceLimitForm as DeviceLimitFormUI,
} from "@/components/admin/device-limit-form";
import { pluralRu } from "@/lib/courses/plural";
import { ActionResult, useActionResult } from "@/components/action-result";
import { DemoAccessSlider } from "@/components/admin/demo-access-slider";
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
  /** Демо-доступ: процент открытых уроков курса (null — курс открыт целиком). */
  demoPercent: number | null;
  /** Опубликованных уроков в курсе — подпись «30% = 9 из 33». */
  lessonsTotal: number;
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
  // Раньше результат этих действий не проверялся вовсе: отказ (курс уже выдан,
  // истёкшая сессия) выглядел точно так же, как успех, — молча.
  const feedback = useActionResult();

  return (
    <section className="rounded-2xl border border-foreground/10 bg-background p-5">
      <h2 className="font-semibold">Доступы к курсам</h2>

      {enrollments.length === 0 ? (
        <p className="mt-3 text-sm text-foreground/50">Доступов пока нет.</p>
      ) : (
        <ul className="mt-3 divide-y divide-foreground/5">
          {enrollments.map((e) => (
            <EnrollmentRow
              feedback={feedback}
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
                const title =
                  grantable.find((c) => c.id === selected)?.title ?? "курс";
                feedback.clear();
                const res = await grantEnrollmentAction({
                  userId,
                  courseId: selected,
                  accessDuration: duration || undefined,
                  site,
                });
                if (res.ok) {
                  feedback.ok(`Доступ к «${title}» выдан.`);
                  setSelected("");
                  setDuration("");
                } else {
                  feedback.fail(res.error);
                }
              })
            }
          >
            Выдать
          </Button>
        </div>
      ) : null}

      <ActionResult result={feedback.result} className="mt-3" />
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
  feedback,
}: {
  userId: string;
  enrollment: EnrollmentView;
  pending: boolean;
  start: (cb: () => Promise<void>) => void;
  defaultSite: string;
  /** Индикатор один на всю секцию: строк много, сообщение должно быть одно. */
  feedback: ReturnType<typeof useActionResult>;
}) {
  const [duration, setDuration] = useState("");
  const [site, setSite] = useState(defaultSite);

  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
              feedback.clear();
              const res = await revokeEnrollmentAction({
                userId,
                courseId: e.courseId,
              });
              if (res.ok) feedback.ok(`Доступ к «${e.title}» отозван.`);
              else feedback.fail(res.error);
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
                feedback.clear();
                const res = await grantEnrollmentAction({
                  userId,
                  courseId: e.courseId,
                  accessDuration: duration || undefined,
                  site,
                });
                if (res.ok) feedback.ok(`Доступ к «${e.title}» выдан снова.`);
                else feedback.fail(res.error);
              })
            }
          >
            Выдать снова
          </Button>
        </div>
      )}
      </div>

      {/* Демо-доступ: часть курса открыта, дальше — экран «после оплаты».
          Показываем только на действующем доступе — на отозванном нечего резать. */}
      {e.status === "active" ? (
        <div className="mt-2 max-w-md">
          <DemoAccessSlider
            percent={e.demoPercent}
            lessonsTotal={e.lessonsTotal}
            save={async (next) => {
              const res = await setEnrollmentDemoAction({
                userId,
                courseId: e.courseId,
                percent: next,
              });
              return res.ok ? { ok: true } : { ok: false, error: res.error };
            }}
          />
        </div>
      ) : null}
    </li>
  );
}

/**
 * Лимит устройств ученика: стандарт / безлимит / своё число, плюс сброс
 * запомненных устройств. Вёрстка общая с карточкой организации — здесь только
 * тексты и вызовы Server Actions.
 */
export function DeviceLimitForm({
  userId,
  deviceLimit,
  orgLimit,
  orgName,
}: {
  userId: string;
  deviceLimit: number | null;
  /** Настройка организации работника — действует, пока своей у него нет. */
  orgLimit?: number | null;
  orgName?: string | null;
}) {
  const inherited =
    orgLimit === null || orgLimit === undefined
      ? null
      : orgLimit <= 0
        ? `Сейчас действует настройка организации${orgName ? ` «${orgName}»` : ""}: без ограничения.`
        : `Сейчас действует настройка организации${orgName ? ` «${orgName}»` : ""}: ${orgLimit} ${pluralRu(orgLimit, "устройство", "устройства", "устройств")}.`;

  return (
    <DeviceLimitFormUI
      value={deviceLimit}
      inheritedNote={inherited}
      description={
        <>
          Сколько устройств может одновременно пользоваться аккаунтом. Вход с
          лишнего устройства просто не состоится — учётную запись это не блокирует
          и на привычных устройствах ничего не меняет. Неиспользуемое устройство
          освобождает место через неделю. {DEVICE_FLAG_NOTE}
        </>
      }
      resetDescription="Стереть запомненные отпечатки устройств: счёт начнётся заново, как будто с этой учётки ещё никто не входил. Нужно после смены телефона или ноутбука — старое устройство иначе занимает место в лимите ещё неделю. Доступ к курсам сброс не трогает."
      onSave={(mode, limit) =>
        setDeviceLimitAction({ userId, mode, ...(mode === "custom" ? { limit } : {}) })
      }
      onReset={async () => {
        const res = await resetDevicesAction({ userId });
        return res.ok ? { ok: true, cleared: res.data.cleared } : res;
      }}
    />
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
  const feedback = useActionResult();

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
              feedback.clear();
              const res = await resetPasswordAction({ userId });
              // Успех показывает сам блок с новым паролем ниже.
              if (res.ok) setNewPassword(res.data.tempPassword);
              else feedback.fail(res.error);
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
              feedback.clear();
              const res = await toggleBlockAction({ userId, blocked: !blocked });
              if (res.ok) {
                feedback.ok(
                  blocked
                    ? "Вход разблокирован — ученик снова может войти."
                    : "Вход заблокирован — ученик больше не войдёт.",
                );
              } else {
                feedback.fail(res.error);
              }
            })
          }
        >
          {blocked ? "Разблокировать вход" : "Заблокировать вход"}
        </Button>
      </div>

      <ActionResult result={feedback.result} className="mt-3" />

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
