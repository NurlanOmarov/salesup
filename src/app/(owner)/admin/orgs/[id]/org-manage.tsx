"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Pause, Play, Trash2 } from "lucide-react";
import {
  createOrgAdminAction,
  removeOrgAdminAction,
  updateOrgAdminAction,
  resetOrgAdminPasswordAction,
  resetOrgKeyAction,
  deleteOrgAction,
  deleteLicenseAction,
  grantLibraryAction,
  grantLicenseAction,
  setOrgStatusAction,
  setLicenseDemoAction,
  setOrgDemoAction,
  setOrgDeviceLimitAction,
  resetOrgDevicesAction,
  updateOrgAction,
} from "../actions";
import { ACCESS_DURATIONS, ACCESS_DURATION_LABELS } from "@/lib/admin/enrollment";
import { MIN_B2B_SEATS, quoteSeats, SUBSCRIPTION_YEAR_TIYN } from "@/lib/pricing";
import { salePrice } from "@/lib/pricing/promo";
import {
  orgAdminPasswordMessage,
  orgAdminWelcomeMessage,
} from "@/lib/messages/templates";
import { SITE_HOSTS } from "@/lib/seo/site-hosts";
import { pluralRu } from "@/lib/courses/plural";
import { ActionResult, useActionResult } from "@/components/action-result";
import { DemoAccessSlider } from "@/components/admin/demo-access-slider";
import {
  DEVICE_FLAG_NOTE,
  DeviceLimitForm as DeviceLimitFormUI,
} from "@/components/admin/device-limit-form";
import { DEVICE_LIMIT } from "@/lib/antishare/limits";
import { ShareMessage } from "@/components/share-message";
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
  const feedback = useActionResult();

  async function change(next: "ACTIVE" | "SUSPENDED" | "ARCHIVED") {
    const confirmText =
      next === "SUSPENDED"
        ? "Приостановить доступ? Все работники организации потеряют доступ к урокам до возобновления."
        : next === "ARCHIVED"
          ? "Отправить в архив? Доступ работников будет прекращён."
          : "Возобновить доступ работникам организации?";
    if (!window.confirm(confirmText)) return;

    setPending(true);
    feedback.clear();
    try {
      const res = await setOrgStatusAction({ orgId, status: next });
      if (res.ok) {
        feedback.ok(
          next === "SUSPENDED"
            ? "Доступ приостановлен — работники не откроют уроки до возобновления."
            : next === "ARCHIVED"
              ? "Организация в архиве, доступ работников прекращён."
              : "Доступ возобновлён — работники снова могут заниматься.",
        );
        router.refresh();
      } else {
        feedback.fail(res.error);
      }
    } catch {
      feedback.fail(
        "Не удалось отправить форму — обновите страницу и попробуйте ещё раз.",
      );
    } finally {
      setPending(false);
    }
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
      <ActionResult result={feedback.result} />
    </div>
  );
}

/** Безвозвратное удаление — только для пустой карточки (см. deleteOrgAction). */
export function DeleteOrgAction({
  orgId,
  orgName,
  isEmpty,
  learners,
}: {
  orgId: string;
  orgName: string;
  /** Ни лицензий, ни работников, ни представителей — удаляем без вопросов. */
  isEmpty: boolean;
  learners: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setError(null);
    try {
      const res = await deleteOrgAction({
        orgId,
        confirmName: isEmpty ? undefined : confirmName,
      });
      if (res.ok) router.push("/admin/orgs");
      else setError(res.error);
    } catch {
      setError("Не удалось удалить — обновите страницу и попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => {
            if (isEmpty) void remove();
            else setOpen(true);
          }}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-sm text-foreground/50 transition-colors hover:border-red-400/60 hover:text-red-600 disabled:opacity-40"
        >
          <Trash2 className="size-4" />
          {pending ? "Удаляем…" : "Удалить"}
        </button>
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className="max-w-sm rounded-xl border border-red-500/40 bg-red-500/[0.04] p-3 text-left">
      <p className="text-sm font-medium text-red-700">Удалить организацию целиком?</p>
      <p className="mt-1 text-xs text-foreground/70">
        Уйдут лицензии, коды, ПИН-код имён и доступы. Учётки работников
        {learners > 0 ? ` (${learners})` : ""} удаляются вместе с прогрессом — кроме
        тех, кому уже выдан сертификат: такие сохраняются заблокированными, чтобы
        публичная проверка сертификата продолжала работать. Отменить нельзя.
      </p>
      <p className="mt-2 text-xs text-foreground/60">
        Введите наименование — <span className="font-medium">{orgName}</span>
      </p>
      <Input
        className="mt-1.5"
        value={confirmName}
        onChange={(e) => setConfirmName(e.target.value)}
        placeholder={orgName}
        autoFocus
      />
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={pending || confirmName.trim() !== orgName}
          onClick={() => void remove()}
        >
          {pending ? "Удаляем…" : "Удалить навсегда"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Отмена
        </Button>
      </div>
    </div>
  );
}

/**
 * Сброс ПИН-кода имён. Именно сброс, а не «посмотреть»: владелец имён не видит
 * и после этой операции — они стираются, потому что без ключа расшифровать их
 * всё равно невозможно. Нужно, когда клиент потерял и ПИН, и код восстановления
 * и не может ни увидеть старые имена, ни завести новые.
 */
export function ResetOrgKeyAction({
  orgId,
  configured,
  named,
}: {
  orgId: string;
  configured: boolean;
  named: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  // Результат показываем раньше состояния: router.refresh() уже принёс
  // configured=false, и без этого порядка ответ подменялся бы сухим «не задан».
  if (done !== null) {
    return (
      <p className="text-sm text-emerald-700">
        ПИН-код сброшен{done > 0 ? `, стёрто имён: ${done}` : ""}. Ответственный
        задаст новый код при следующем входе в кабинет.
      </p>
    );
  }

  if (!configured) {
    return (
      <p className="text-sm text-foreground/55">
        ПИН-код имён не задан — работники видны по кодам у всех.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <p className="text-sm text-foreground/70">
        Имена заданы у {named} из работников организации. Прочитать их мы не можем —
        только сбросить код целиком, и тогда имена будут стёрты безвозвратно.
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={async () => {
          if (
            !window.confirm(
              "Сбросить ПИН-код? Имена работников будут стёрты без возможности восстановления. Прогресс, доступы и коды не пострадают.",
            )
          )
            return;
          setPending(true);
          setError(null);
          try {
            const res = await resetOrgKeyAction({ orgId });
            if (res.ok) {
              setDone(res.data.namesErased);
              router.refresh();
            } else {
              setError(res.error);
            }
          } catch {
            setError("Не удалось сбросить — попробуйте ещё раз.");
          } finally {
            setPending(false);
          }
        }}
      >
        <KeyRound className="mr-1.5 size-4" />
        {pending ? "Сбрасываем…" : "Сбросить ПИН-код имён"}
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}

// ─────────────────────────── Лицензии ───────────────────────────

export function LicenseForm({
  orgId,
  courses,
  existing,
  hasAdmins,
}: {
  orgId: string;
  courses: CourseOption[];
  existing: LicenseValue[];
  /** Назначен ли уже ответственный: если нет — после выдачи ведём к этому шагу. */
  hasAdmins: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const feedback = useActionResult();
  const [mode, setMode] = useState<"course" | "library">("course");
  // Пусто по умолчанию: предвыбранный первый курс утверждается не глядя — так
  // клиенту и уехала лицензия на чужой курс.
  const [courseId, setCourseId] = useState("");
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
  // Во время акции клиент платит половину, и в лицензию должна попасть именно
  // эта сумма: иначе отчёты по выручке покажут деньги, которых не было.
  const seatSale = salePrice(quote.pricePerSeatTiyn);

  async function onSubmit(formData: FormData) {
    setPending(true);
    feedback.clear();
    const priceByn = formData.get("priceByn");
    const priceTiyn = priceByn ? Math.round(Number(priceByn) * 100) : undefined;
    // Считаем ДО отправки: после router.refresh() форма получит новые данные,
    // и «выдана» уже не отличить от «изменена».
    const seatsSent = Number(formData.get("seatsTotal")) || 0;
    const seatsWord = pluralRu(seatsSent, "место", "места", "мест");
    const courseTitle = courses.find((c) => c.id === courseId)?.title ?? "";
    const wasExisting = Boolean(current);

    try {
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
      if (res.ok) {
        const durationLabel =
          ACCESS_DURATION_LABELS[
            accessDuration as keyof typeof ACCESS_DURATION_LABELS
          ];
        const what =
          mode === "library"
            ? `Выданы лицензии на все ${courses.length} курсов — по ${seatsSent} ${seatsWord}, доступ ${durationLabel}.`
            : wasExisting
              ? `Лицензия обновлена: «${courseTitle}» — ${seatsSent} ${seatsWord}, доступ ${durationLabel}.`
              : `Лицензия выдана: «${courseTitle}» — ${seatsSent} ${seatsWord}, доступ ${durationLabel}.`;
        // Объясняем прыжок страницы: иначе смена экрана выглядит сбоем.
        feedback.ok(
          hasAdmins ? what : `${what} Дальше — назначьте ответственного, форма ниже.`,
        );
        router.refresh();
        // Лицензия есть — следующий шаг запуска: ответственный. Пока его нет,
        // форма выдачи остаётся последним, что видел человек, и шаг теряется
        // под таблицей лицензий. Ждём перерисовку после refresh, иначе якорь
        // ещё на старом месте.
        if (!hasAdmins) {
          window.setTimeout(() => {
            document
              .getElementById("admins")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 400);
        }
      } else {
        feedback.fail(res.error);
      }
    } catch {
      feedback.fail(
        "Не удалось отправить форму — обновите страницу и попробуйте ещё раз.",
      );
    } finally {
      setPending(false);
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
            <option value="">— выберите курс —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} — {c.priceTiyn / 100} бел. руб.
              </option>
            ))}
          </select>
          {!courseId ? (
            <p className="text-xs text-foreground/55">
              Выберите курс — лицензия выдаётся на конкретный курс, и поменять его
              потом можно только удалением лишней лицензии.
            </p>
          ) : current ? (
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
          key={seatSale.tiyn}
          defaultValue={seatSale.tiyn > 0 ? seatSale.tiyn / 100 : undefined}
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
              <span className="font-semibold">{seatSale.tiyn / 100} бел. руб.</span> за
              место, итого{" "}
              <span className="font-semibold">
                {(seatSale.tiyn * seatCount) / 100} бел. руб.
              </span>{" "}
              в год
              <span className="text-foreground/50">
                {" "}
                (экономия {quote.savingTiyn / 100} бел. руб.)
              </span>
              {seatSale.oldTiyn ? (
                <span className="block text-brand-strong">
                  Акция −{seatSale.percent} %: без неё было бы{" "}
                  {seatSale.oldTiyn / 100} бел. руб. за место и {quote.totalTiyn / 100} бел. руб. за год.
                </span>
              ) : null}
            </p>
          ) : (
            <p className="text-amber-700">
              Меньше {MIN_B2B_SEATS} мест — корпоративная скидка не применяется.
              Такой объём выгоднее продать в розницу: {retailTiyn / 100} бел. руб. за место.
            </p>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button
          type="submit"
          disabled={pending || (mode === "course" && !courseId)}
        >
          {pending
            ? "Сохраняем…"
            : mode === "library"
              ? "Выдать все курсы"
              : current
                ? "Изменить лицензию"
                : "Выдать лицензию"}
        </Button>
        <ActionResult result={feedback.result} />
      </div>
    </form>
  );
}

/**
 * Удаление лицензии — исправление ошибочной выдачи (не тот курс, не тому
 * клиенту). Занятая лицензия не удаляется: сервер откажет, и кнопка об этом
 * предупреждает заранее, а не после клика.
 */
export function DeleteLicenseButton({
  orgId,
  licenseId,
  courseTitle,
  used,
}: {
  orgId: string;
  licenseId: string;
  courseTitle: string;
  /** Открытых мест по этой лицензии. Больше нуля — удалять нельзя. */
  used: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const feedback = useActionResult();

  if (used > 0) {
    return (
      <span
        className="text-xs text-foreground/40"
        title="Сначала закройте доступы работников в кабинете клиента — тогда лицензию можно будет удалить."
      >
        занята
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (
            !window.confirm(
              `Удалить лицензию на «${courseTitle}»? Мест по ней никто не занимает — курс просто пропадёт из списка клиента.`,
            )
          ) {
            return;
          }
          setPending(true);
          feedback.clear();
          try {
            const res = await deleteLicenseAction({ orgId, licenseId });
            if (res.ok) {
              feedback.ok(`Лицензия на «${courseTitle}» удалена.`);
              router.refresh();
            } else {
              feedback.fail(res.error);
            }
          } catch {
            feedback.fail("Не удалось удалить — попробуйте ещё раз.");
          } finally {
            setPending(false);
          }
        }}
        className="text-xs text-red-600 hover:underline disabled:opacity-50"
      >
        {pending ? "Удаляем…" : "удалить"}
      </button>
      <ActionResult result={feedback.result} className="text-xs" />
    </span>
  );
}

// ─────────────────────────── Ответственный представитель ───────────────────────────

export function OrgAdminForm({
  orgId,
  orgName,
  siteUrl,
}: {
  orgId: string;
  orgName: string;
  siteUrl: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    email: string;
    tempPassword: string | null;
    existed: boolean;
  } | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const res = await createOrgAdminAction({
        orgId,
        email: formData.get("email"),
        name: formData.get("name") || undefined,
      });
      if (res.ok) {
        setCreated({
          email: res.data.email,
          tempPassword: res.data.tempPassword,
          existed: res.data.existed,
        });
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Не удалось отправить форму — обновите страницу и попробуйте ещё раз.");
    } finally {
      setPending(false);
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
          {created.tempPassword ? (
            <>
              Пароль показывается <strong>один раз</strong>: при первом входе он будет
              заменён. Скопируйте сообщение ниже и отправьте его клиенту — в нём
              есть логин, пароль и объяснение, что делать дальше.
            </>
          ) : (
            <>
              Учётная запись с таким e-mail уже была — мы только выдали ей права
              в кабинете. Пароль <strong>остался прежним</strong>; если он утерян,
              сбросьте его в списке представителей — сообщение с новым паролем
              появится там же.
            </>
          )}
        </p>
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-foreground/50">Логин</dt>
            <dd className="font-mono">{created.email}</dd>
          </div>
          {created.tempPassword ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-foreground/50">
                Временный пароль
              </dt>
              <dd className="font-mono">{created.tempPassword}</dd>
            </div>
          ) : null}
        </dl>

        {created.tempPassword ? (
          <div className="mt-4">
            <ShareMessage
              text={orgAdminWelcomeMessage({
                orgName,
                login: created.email,
                tempPassword: created.tempPassword,
                siteUrl,
              })}
              title="Сообщение ответственному"
              hint="Скопируйте и отправьте клиенту в мессенджере"
              rows={10}
            />
          </div>
        ) : null}

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

/**
 * Блок назначения. Пока представителя нет — форма открыта: это шаг запуска
 * клиента. Как только кабинетом есть кому пользоваться, форма прячется за
 * кнопку: открытые поля рядом со списком читались как «здесь меняют
 * назначенного», хотя они заводят второго.
 */
export function AddOrgAdminPanel({
  orgId,
  orgName,
  siteUrl,
  hasAdmins,
}: {
  orgId: string;
  orgName: string;
  siteUrl: string;
  hasAdmins: boolean;
}) {
  const [open, setOpen] = useState(!hasAdmins);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Назначить ещё одного представителя
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-foreground/10 bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">
          {hasAdmins ? "Назначить ещё одного представителя" : "Назначить ответственного"}
        </h3>
        {hasAdmins ? (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-foreground/50 hover:underline"
          >
            свернуть
          </button>
        ) : null}
      </div>
      {hasAdmins ? (
        <p className="mt-1 text-xs text-foreground/55">
          Это создаст вторую учётку кабинета. Чтобы передать кабинет другому
          человеку, не заводите вторую — нажмите «изменить» у назначенного.
        </p>
      ) : null}
      <div className="mt-3">
        <OrgAdminForm orgId={orgId} orgName={orgName} siteUrl={siteUrl} />
      </div>
    </div>
  );
}

/**
 * Правка назначенного представителя: e-mail (он же логин), имя и снятие с
 * должности. Именно сюда ведёт «сменить ответственного» — передать кабинет
 * другому человеку, а не завести рядом второго.
 */
export function EditOrgAdmin({
  orgId,
  userId,
  email,
  name,
}: {
  orgId: string;
  userId: string;
  email: string;
  name: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-foreground/50 hover:text-foreground hover:underline"
      >
        изменить
      </button>
    );
  }

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const res = await updateOrgAdminAction({
        orgId,
        userId,
        email: formData.get("email"),
        name: formData.get("name") || undefined,
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Не удалось отправить форму — обновите страницу и попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className="mt-3 w-full space-y-3 rounded-lg border border-foreground/10 p-3">
      <p className="text-xs text-foreground/55">
        E-mail — это логин представителя. Меняете адрес — вход по старому
        перестанет работать; пароль остаётся прежним, при передаче кабинета
        другому человеку сбросьте его рядом.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`admin-email-${userId}`}>E-mail *</Label>
          <Input
            id={`admin-email-${userId}`}
            name="email"
            type="email"
            required
            defaultValue={email}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`admin-name-${userId}`}>Имя (необязательно)</Label>
          <Input
            id={`admin-name-${userId}`}
            name="name"
            defaultValue={name ?? ""}
            placeholder="Для обращения в письмах"
          />
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Сохраняем…" : "Сохранить"}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-foreground/50 hover:underline"
        >
          отмена
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            if (
              !window.confirm(
                "Снять с должности? Учётная запись останется, но кабинет организации закроется.",
              )
            )
              return;
            setPending(true);
            setError(null);
            try {
              const res = await removeOrgAdminAction({ orgId, userId });
              if (res.ok) router.refresh();
              else setError(res.error);
            } catch {
              setError("Не удалось отправить — попробуйте ещё раз.");
            } finally {
              setPending(false);
            }
          }}
          className="ml-auto text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          снять с должности
        </button>
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
    site: string | null;
  };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [site, setSite] = useState(org.site ?? SITE_HOSTS[0].code);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await updateOrgAction({
        orgId: org.id,
        name: formData.get("name"),
        unp: formData.get("unp") || undefined,
        contactEmail: formData.get("contactEmail") || undefined,
        contactNote: formData.get("contactNote") || undefined,
        note: formData.get("note") || undefined,
        site,
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Не удалось отправить форму — обновите страницу и попробуйте ещё раз.");
    } finally {
      setPending(false);
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
        <Label htmlFor="org-site">Домен / рынок</Label>
        <select
          id="org-site"
          value={site}
          onChange={(e) => setSite(e.target.value)}
          className="h-10 w-full rounded-lg border border-foreground/15 bg-background px-3 text-sm"
        >
          {SITE_HOSTS.map((h) => (
            <option key={h.code} value={h.code}>
              {h.country.ru} — {h.host}
            </option>
          ))}
        </select>
        <p className="text-xs text-foreground/55">
          Домен в готовых сообщениях — и вашим, и тем, что рассылает ответственный
          работникам. На уже выданные доступы не влияет: учётка работает на любом
          нашем домене.
        </p>
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

/**
 * Сброс пароля ответственного представителя. Новый пароль владелец передаёт
 * клиенту лично — так же, как первый: писем в MVP нет, и это единственный путь
 * вернуть доступ к кабинету, если пароль потерян.
 */
export function ResetOrgAdminPassword({
  orgId,
  userId,
  login,
  siteUrl,
}: {
  orgId: string;
  userId: string;
  /** Логин ответственного — попадёт в готовое сообщение вместе с паролем. */
  login: string;
  siteUrl: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);

  if (password) {
    return (
      <div className="w-full">
        <ShareMessage
          text={orgAdminPasswordMessage({ login, tempPassword: password, siteUrl })}
          title="Новый временный пароль"
          hint="Показывается один раз — скопируйте и отправьте клиенту"
        />
        <button
          type="button"
          onClick={() => setPassword(null)}
          className="mt-2 text-xs text-foreground/50 hover:underline"
        >
          скрыть
        </button>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (!window.confirm("Выдать новый временный пароль? Старый перестанет работать.")) return;
          setPending(true);
          setError(null);
          try {
            const res = await resetOrgAdminPasswordAction({ orgId, userId });
            if (res.ok) {
              setPassword(res.data.tempPassword);
              router.refresh();
            } else {
              setError(res.error);
            }
          } catch {
            setError("Не удалось отправить — попробуйте ещё раз.");
          } finally {
            setPending(false);
          }
        }}
        className="text-xs text-foreground/50 hover:text-foreground hover:underline disabled:opacity-50"
      >
        {pending ? "сбрасываем…" : "сбросить пароль"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}


// ─────────────────────────── Демо-доступ ───────────────────────────

/**
 * Демо по одной лицензии. Лимит наследуют все места этой лицензии — и те, что
 * работники займут сами позже: оплата снимается одним «Открыть полностью».
 */
export function LicenseDemoControl({
  orgId,
  licenseId,
  percent,
  lessonsTotal,
}: {
  orgId: string;
  licenseId: string;
  percent: number | null;
  lessonsTotal: number;
}) {
  return (
    <DemoAccessSlider
      percent={percent}
      lessonsTotal={lessonsTotal}
      save={async (next) => {
        const res = await setLicenseDemoAction({ orgId, licenseId, percent: next });
        return res.ok ? { ok: true } : { ok: false, error: res.error };
      }}
    />
  );
}

/** Демо разом по всем лицензиям компании — «бесплатный клиент» одной ручкой. */
export function OrgDemoControl({
  orgId,
  percent,
  lessonsTotal,
  mixed,
}: {
  orgId: string;
  /** Общее значение, если оно одинаково у всех лицензий; иначе null. */
  percent: number | null;
  /** Средняя длина курсов компании — для подписи «≈ N уроков». */
  lessonsTotal: number;
  /** У лицензий разные значения: подпись предупреждает, что действие их уравняет. */
  mixed: boolean;
}) {
  return (
    <DemoAccessSlider
      percent={percent}
      lessonsTotal={lessonsTotal}
      hint={
        mixed
          ? "Сейчас у лицензий разные настройки — сохранение уравняет их все."
          : "Применяется ко всем лицензиям компании и снимает индивидуальные настройки мест."
      }
      save={async (next) => {
        const res = await setOrgDemoAction({ orgId, percent: next });
        return res.ok ? { ok: true } : { ok: false, error: res.error };
      }}
    />
  );
}

/**
 * Лимит устройств клиента: действует на всех его работников сразу. Персональная
 * настройка работника (карточка ученика) сильнее и здесь не сбрасывается.
 */
export function OrgDeviceLimitControl({
  orgId,
  deviceLimit,
  members,
}: {
  orgId: string;
  deviceLimit: number | null;
  /** Сколько работников заведено — чтобы сброс говорил, кого он касается. */
  members: number;
}) {
  return (
    <DeviceLimitFormUI
      value={deviceLimit}
      defaultLabel={`Как на платформе (${DEVICE_LIMIT})`}
      defaultHint="Стандартный лимит"
      description={
        <>
          Сколько устройств может одновременно пользоваться учётной записью
          работника. Действует на всех работников компании; если кому-то задан
          личный лимит в его карточке, у него остаётся личный. Вход с лишнего
          устройства просто не состоится, учётную запись это не блокирует, а
          неиспользуемое устройство освобождает место через неделю. {DEVICE_FLAG_NOTE}
        </>
      }
      resetTitle="Забыть устройства работников"
      resetDescription={
        members === 0
          ? "Работников пока нет — стирать нечего."
          : `Стереть запомненные устройства у всех работников (${members}): счёт начнётся заново, как будто никто ещё не входил. Пригодится после смены парка техники. Доступы к курсам сброс не трогает.`
      }
      resetLabel="Сбросить устройства всем"
      onSave={(mode, limit) =>
        setOrgDeviceLimitAction({ orgId, mode, ...(mode === "custom" ? { limit } : {}) })
      }
      onReset={async () => {
        const res = await resetOrgDevicesAction({ orgId });
        return res.ok ? { ok: true, cleared: res.data.cleared } : res;
      }}
    />
  );
}
