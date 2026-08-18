"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateLeadAction } from "./actions";

const STATUS_OPTIONS = [
  { value: "NEW", label: "Новая" },
  { value: "CONTACTED", label: "Связались" },
  { value: "PAID", label: "Оплачено" },
  { value: "DECLINED", label: "Отказ" },
] as const;

type Status = (typeof STATUS_OPTIONS)[number]["value"];

export interface LeadView {
  id: string;
  /** B2C — розничный ученик, B2B — заявка со страницы /business. */
  kind: "B2C" | "B2B";
  /** OFFLINE — запрос на живой тренинг: в платформе по нему действий нет. */
  format: "ONLINE" | "OFFLINE";
  company: string | null;
  /** Сколько сотрудников хотят обучать: сразу виден уровень корпоративной сетки. */
  seatsWanted: number | null;
  name: string | null;
  contact: string;
  courseTitle: string | null;
  message: string | null;
  status: Status;
  comment: string | null;
  createdAt: string;
  /** Выбранный тариф и цена, которую человек видел на экране («вся библиотека на год · 839 Br × 12 = 10 068 Br»). */
  plan: string | null;
  /** Дата и редакция принятого согласия на обработку ПДн; null — заявка до ввода отметки. */
  consent: string | null;
}

function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export function LeadRow({ lead }: { lead: LeadView }) {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<Status>(lead.status);
  const [comment, setComment] = useState(lead.comment ?? "");
  const [saved, setSaved] = useState(false);

  const save = (nextStatus: Status, nextComment: string) =>
    start(async () => {
      await updateLeadAction({ leadId: lead.id, status: nextStatus, comment: nextComment });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });

  const isB2b = lead.kind === "B2B";
  const isOffline = lead.format === "OFFLINE";
  const contactIsEmail = looksLikeEmail(lead.contact);

  // Куда ведёт кнопка, зависит от типа заявки: по корпоративной заводится
  // организация, а не ученик. Раньше кнопка всегда вела в розничную форму, и по
  // свежей заявке об этом легко было забыть.
  const createUrl = new URLSearchParams();
  if (isB2b) {
    if (lead.company) createUrl.set("name", lead.company);
    else if (lead.name) createUrl.set("name", lead.name);
    if (contactIsEmail) createUrl.set("email", lead.contact);
    else createUrl.set("contact", lead.contact);
    // Заметка владельцу: с чем пришёл клиент — число мест и выбранный тариф.
    const note = [
      lead.seatsWanted ? `${lead.seatsWanted} сотрудников` : null,
      lead.plan,
      `заявка от ${lead.createdAt}`,
    ]
      .filter(Boolean)
      .join(" · ");
    createUrl.set("note", note);
  } else {
    if (lead.name) createUrl.set("name", lead.name);
    if (contactIsEmail) createUrl.set("email", lead.contact);
  }

  const createHref = isB2b
    ? `/admin/orgs/new?${createUrl.toString()}`
    : `/admin/students/new?${createUrl.toString()}`;

  return (
    <div className="rounded-xl border border-foreground/10 bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {lead.name ?? "Без имени"}
            {isOffline ? (
              // Офлайн выделяем отдельно: по такой заявке ничего не создаётся в
              // платформе, это разговор про выездной тренинг с преподавателем.
              <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-700">
                Офлайн-тренинг
              </span>
            ) : lead.kind === "B2B" ? (
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
                Компания
              </span>
            ) : null}
          </p>
          <p className="text-sm text-foreground/70">{lead.contact}</p>
          {lead.kind === "B2B" ? (
            <p className="mt-0.5 text-xs text-foreground/60">
              {lead.company ?? "организация не указана"}
              {lead.seatsWanted
                ? ` · ${lead.seatsWanted} ${isOffline ? "участников" : "сотрудников"}`
                : ""}
            </p>
          ) : null}
          {lead.courseTitle ? (
            <p className="mt-0.5 text-xs text-amber-700">Курс: {lead.courseTitle}</p>
          ) : null}
          {lead.plan ? (
            <p className="mt-0.5 text-xs font-medium text-foreground/70">{lead.plan}</p>
          ) : null}
          {lead.message ? (
            <p className="mt-1 text-sm text-foreground/60">«{lead.message}»</p>
          ) : null}
          <p className="mt-1 text-xs text-foreground/40">
            {lead.consent
              ? `Согласие на обработку ПДн: ${lead.consent}`
              : "Согласие на обработку ПДн не зафиксировано"}
          </p>
        </div>
        <span className="text-xs text-foreground/40">{lead.createdAt}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => {
            const next = e.target.value as Status;
            setStatus(next);
            save(next, comment);
          }}
          disabled={pending}
          className="rounded-md border border-foreground/15 bg-background px-2.5 py-1.5 text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => save(status, comment)}
          placeholder="Комментарий…"
          className="flex-1 rounded-md border border-foreground/15 bg-background px-2.5 py-1.5 text-sm"
        />

        {isOffline ? (
          <span className="text-xs text-foreground/50">
            Тренинг ведётся вне платформы — договоритесь и отметьте статус
          </span>
        ) : (
          <Link
            href={createHref}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
          >
            {isB2b ? "Создать организацию" : "Создать ученика"}
          </Link>
        )}

        {saved ? <span className="text-xs text-emerald-600">Сохранено</span> : null}
      </div>
    </div>
  );
}
