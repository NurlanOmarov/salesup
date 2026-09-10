"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion } from "framer-motion";
import { BarChart3, Lock, ShieldCheck, X } from "lucide-react";
import type { OrgProgressSnapshot } from "@/lib/org/reports";
import { orgProgressAction } from "./actions";
import { OrgStatusBadge, ProgressBar, relativeDays } from "./org-ui";

/**
 * «Как учится компания» прямо из реестра клиентов: раньше ответ на этот вопрос
 * стоил перехода в карточку и обратно по каждому клиенту подряд. Кнопка в
 * строке открывает окно со сводкой, разрезом по курсам и списком работников —
 * теми же цифрами, что клиент видит в своём кабинете.
 *
 * Данные тянем по клику (orgProgressAction), а не вместе со списком: полный
 * отчёт по каждой организации при открытии реестра — лишняя работа для базы.
 *
 * ФИО здесь нет и быть не может: работник опознаётся только логином вида
 * acme-0042 (правило 9 CLAUDE.md, оферта /offer-b2b).
 */
export function OrgProgressButton({
  orgId,
  orgName,
  disabled,
}: {
  orgId: string;
  orgName: string;
  /** Лицензий нет — учиться нечему, показывать нечего. */
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (disabled) {
    return <span className="text-xs text-foreground/40">—</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-foreground/15 px-2 py-1 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <BarChart3 className="size-3.5" />
        Обучение
      </button>
      {open ? (
        <OrgProgressDialog
          orgId={orgId}
          orgName={orgName}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function OrgProgressDialog({
  orgId,
  orgName,
  onClose,
}: {
  orgId: string;
  orgName: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<OrgProgressSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await orgProgressAction({ orgId });
      if (res.ok) setData(res.data);
      else setError(res.error);
    } catch {
      setError("Не удалось загрузить отчёт");
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Esc закрывает, фон не прокручивается под окном.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  // Портал: строка таблицы — неподходящий контекст для модального окна.
  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Обучение: ${orgName}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-foreground/10 bg-background shadow-xl sm:max-h-[85vh] sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-foreground/10 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-foreground/50">
              Как учится компания
            </p>
            <h2 className="mt-0.5 flex flex-wrap items-center gap-2 text-lg font-semibold">
              {data?.orgName ?? orgName}
              {data ? <OrgStatusBadge status={data.status} /> : null}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="Закрыть"
            className="rounded-lg p-1.5 text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="py-10 text-center">
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-3 rounded-lg border border-foreground/15 px-3 py-1.5 text-sm transition-colors hover:bg-foreground/5"
              >
                Повторить
              </button>
            </div>
          ) : !data ? (
            <Skeleton />
          ) : (
            <SnapshotBody data={data} />
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-foreground/10 px-5 py-3">
          <p className="inline-flex items-center gap-1.5 text-xs text-foreground/50">
            <ShieldCheck className="size-3.5" />
            только условные обозначения — ФИО платформа не получает
          </p>
          <Link
            href={`/admin/orgs/${orgId}`}
            className="text-sm font-medium text-amber-700 hover:underline"
          >
            Открыть карточку компании →
          </Link>
        </footer>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

function SnapshotBody({ data }: { data: OrgProgressSnapshot }) {
  if (data.courses.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-foreground/55">
        У компании нет лицензий — учиться пока нечему. Выдайте лицензию в
        карточке клиента, и здесь появится прогресс.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Tile label="Учащихся" value={String(data.learners)} />
        <Tile
          label="Средний прогресс"
          value={`${Math.round(data.avgProgress * 100)}%`}
        />
        <Tile
          label="Не приступали"
          value={String(data.notStarted)}
          tone={data.notStarted > 0 ? "warn" : undefined}
        />
        <Tile label="Активны за 7 дней" value={String(data.activeLast7d)} />
        <Tile label="Сертификатов" value={String(data.certificates)} />
      </div>

      <section className="mt-6">
        <h3 className="text-sm font-semibold">По курсам</h3>
        <div className="mt-2 overflow-x-auto rounded-xl border border-foreground/10">
          <table className="w-full text-sm">
            <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
              <tr>
                <th className="px-3 py-2 font-medium">Курс</th>
                <th className="px-3 py-2 font-medium">Учатся</th>
                <th className="px-3 py-2 font-medium">Прогресс</th>
                <th className="px-3 py-2 font-medium">Прошли</th>
                <th className="px-3 py-2 font-medium">Не начали</th>
                <th className="px-3 py-2 font-medium">Балл</th>
                <th className="px-3 py-2 font-medium">Лицензия до</th>
              </tr>
            </thead>
            <tbody>
              {data.courses.map((c) => (
                <tr
                  key={c.courseId}
                  className="border-b border-foreground/5 last:border-0"
                >
                  <td className="px-3 py-2">
                    <span className="font-medium">{c.courseTitle}</span>
                    {c.demoPercent != null ? (
                      <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-700">
                        <Lock className="size-3" />
                        демо {c.demoPercent}%
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-foreground/70">
                    {c.learners}
                    <span className="text-foreground/40">
                      {" "}
                      / {c.seatsTotal} мест
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <ProgressBar value={c.avgProgress} />
                  </td>
                  <td className="px-3 py-2 text-foreground/70">
                    {c.completed}
                  </td>
                  <td className="px-3 py-2 text-foreground/70">
                    {c.notStarted}
                  </td>
                  <td className="px-3 py-2 text-foreground/70">
                    {c.avgScore == null ? "—" : `${c.avgScore}%`}
                  </td>
                  <td className="px-3 py-2 text-foreground/70">
                    {c.expiresAt
                      ? c.expiresAt.toLocaleDateString("ru-RU")
                      : "бессрочно"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">Работники</h3>
          {data.members.length > 0 ? (
            <p className="text-xs text-foreground/50">отстающие сверху</p>
          ) : null}
        </div>
        <div className="mt-2 overflow-x-auto rounded-xl border border-foreground/10">
          {data.members.length === 0 ? (
            <p className="p-6 text-center text-sm text-foreground/50">
              Работников пока нет: ответственный представитель создаёт коды
              самозаписи в своём кабинете и раздаёт их сотрудникам.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
                <tr>
                  <th className="px-3 py-2 font-medium">Код</th>
                  <th className="px-3 py-2 font-medium">Подразделение</th>
                  <th className="px-3 py-2 font-medium">Курсов</th>
                  <th className="px-3 py-2 font-medium">Прогресс</th>
                  <th className="px-3 py-2 font-medium">Балл</th>
                  <th className="px-3 py-2 font-medium">Активность</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr
                    key={m.membershipId}
                    className="border-b border-foreground/5 last:border-0"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/students/${m.userId}`}
                        className="font-mono text-amber-700 hover:underline"
                      >
                        {m.login}
                      </Link>
                      {!m.isActive ? (
                        <span className="ml-2 rounded bg-foreground/10 px-1.5 py-0.5 text-xs text-foreground/60">
                          отключён
                        </span>
                      ) : m.notStarted ? (
                        <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-700">
                          не начинал
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-foreground/70">
                      {m.groupName ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-foreground/70">
                      {m.courses}
                    </td>
                    <td className="px-3 py-2">
                      <ProgressBar value={m.progress} />
                      <span className="text-xs text-foreground/45">
                        {m.lessonsDone} из {m.lessonsTotal} уроков
                      </span>
                    </td>
                    <td className="px-3 py-2 text-foreground/70">
                      {m.avgScore == null ? "—" : `${m.avgScore}%`}
                    </td>
                    <td className="px-3 py-2 text-foreground/70">
                      {relativeDays(m.lastActiveAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div className="rounded-xl border border-foreground/10 p-3">
      <p className="text-xs uppercase tracking-wide text-foreground/50">
        {label}
      </p>
      <p
        className={[
          "mt-1 text-xl font-bold tabular-nums",
          tone === "warn" ? "text-amber-700" : "",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

/** Пока считается отчёт — каркас вместо прыгающего окна. */
function Skeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Загружаем отчёт">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-foreground/5" />
        ))}
      </div>
      <div className="h-28 rounded-xl bg-foreground/5" />
      <div className="h-40 rounded-xl bg-foreground/5" />
    </div>
  );
}
