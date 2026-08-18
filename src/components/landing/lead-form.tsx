"use client";

import { useActionState, useEffect } from "react";
import { Link } from "@/components/i18n/link";
import { useLocale } from "@/i18n/client";
import { messagesFor } from "@/i18n/messages";
import { motion } from "framer-motion";
import { createLeadAction, type LeadFormState } from "@/app/(marketing)/actions";
import { trackEvent } from "@/lib/analytics/track";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LeadFormState = {};

/**
 * Форма заявки (без онлайн-оплаты): имя + контакт + сообщение → Lead.
 *
 * В корпоративном регистре (`kind="B2B"`) добавляются организация и число
 * сотрудников: по нему сразу виден уровень сетки скидок, и менеджеру не нужно
 * переспрашивать «а сколько вас» первым же сообщением.
 */
export function LeadForm({
  courseId,
  className,
  kind = "B2C",
  format = "ONLINE",
  defaultSeats,
  defaultMessage,
  plan,
  planCourseIds,
}: {
  courseId?: string;
  className?: string;
  kind?: "B2C" | "B2B";
  /** Офлайн — заявка на живой тренинг: без тарифов и расчёта. */
  format?: "ONLINE" | "OFFLINE";
  defaultSeats?: number;
  /** Предзаполненный комментарий: например, курсы, выбранные в калькуляторе. */
  defaultMessage?: string;
  /** Тариф из калькулятора; цену по нему пересчитывает сервер. */
  plan?: "LIBRARY" | "COURSES";
  /** id выбранных курсов — по ним сервер считает ту же сумму, что на экране. */
  planCourseIds?: string[];
}) {
  const isB2b = kind === "B2B";
  const isOffline = format === "OFFLINE";
  // Форма показывается и на казахской версии витрины (i18n/messages.ts).
  const t = messagesFor(useLocale());
  const [state, formAction, isPending] = useActionState(
    createLeadAction,
    initialState,
  );

  // Конверсия в счётчики — только по факту успешной отправки (маркетинговый слой,
  // D-002). courseId кладём в параметр, чтобы видеть, какой курс приносит заявки.
  useEffect(() => {
    if (state.ok) {
      trackEvent("lead_submit", { kind, format, ...(courseId ? { courseId } : {}) });
    }
  }, [state.ok, courseId, kind, format]);

  if (state.ok) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className={className}
      >
        <div className="rounded-2xl border border-green-600/30 bg-green-600/5 p-6 text-center">
          <p className="text-lg font-semibold">{t.lead.sent}</p>
          <p className="mt-1 text-sm text-foreground/70">
            {isOffline
              ? t.lead.sentOffline
              : isB2b
                ? t.lead.sentB2b
                : t.lead.sentB2c}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <form action={formAction} className={className}>
      {courseId ? <input type="hidden" name="courseId" value={courseId} /> : null}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="format" value={format} />
      {plan ? <input type="hidden" name="plan" value={plan} /> : null}
      {planCourseIds && planCourseIds.length > 0 ? (
        <input type="hidden" name="planCourseIds" value={planCourseIds.join(",")} />
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="lead-name">Имя</Label>
        <Input id="lead-name" name="name" placeholder={t.lead.namePlaceholder} />
      </div>
      {isB2b ? (
        <>
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="lead-company">{t.lead.company}</Label>
            <Input
              id="lead-company"
              name="company"
              placeholder={t.lead.companyPlaceholder}
            />
          </div>
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="lead-seats">
              {isOffline ? t.lead.participants : t.lead.employees}
            </Label>
            <Input
              id="lead-seats"
              name="seatsWanted"
              type="number"
              min={1}
              max={100000}
              defaultValue={defaultSeats}
              placeholder="10"
            />
          </div>
        </>
      ) : null}
      <div className="mt-3 space-y-1.5">
        <Label htmlFor="lead-contact">{t.lead.contact}</Label>
        <Input
          id="lead-contact"
          name="contact"
          required
          placeholder="+7 700 000 00 00"
        />
      </div>
      <div className="mt-3 space-y-1.5">
        <Label htmlFor="lead-message">{t.lead.comment}</Label>
        <Input
          id="lead-message"
          name="message"
          key={defaultMessage}
          defaultValue={defaultMessage}
          placeholder={
            isOffline
              ? t.lead.commentOffline
              : isB2b
                ? t.lead.commentB2b
                : t.lead.commentB2c
          }
        />
      </div>

      {/*
        Согласие по Закону РБ № 99-З должно быть осознанным и конкретным, а не
        «по факту нажатия кнопки»: отдельная непредзаполненная отметка, обязательная
        для отправки. Факт и версия редакции сохраняются в Lead (см. actions.ts).
      */}
      <label className="mt-4 flex items-start gap-2.5 text-xs text-foreground/60">
        <input
          type="checkbox"
          name="consent"
          value="on"
          required
          className="mt-0.5 size-4 shrink-0 accent-brand"
        />
        <span>
          {t.lead.consentBefore}{" "}
          <Link href="/privacy" className="underline hover:text-brand">
            {t.lead.consentPrivacy}
          </Link>{" "}
          {t.lead.consentMiddle}{" "}
          <Link href={isB2b ? "/offer-b2b" : "/offer"} className="underline hover:text-brand">
            {isB2b ? t.lead.consentOfferB2b : t.lead.consentOffer}
          </Link>
          .
        </span>
      </label>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        variant="brand"
        className="mt-4 w-full"
        disabled={isPending}
      >
        {isPending
          ? t.lead.submitting
          : isOffline
            ? t.lead.submitOffline
            : isB2b
              ? t.lead.submitB2b
              : t.lead.submitB2c}
      </Button>
    </form>
  );
}
