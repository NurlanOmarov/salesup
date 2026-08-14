"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
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
  defaultSeats,
}: {
  courseId?: string;
  className?: string;
  kind?: "B2C" | "B2B";
  defaultSeats?: number;
}) {
  const isB2b = kind === "B2B";
  const [state, formAction, isPending] = useActionState(
    createLeadAction,
    initialState,
  );

  // Конверсия в счётчики — только по факту успешной отправки (маркетинговый слой,
  // D-002). courseId кладём в параметр, чтобы видеть, какой курс приносит заявки.
  useEffect(() => {
    if (state.ok) {
      trackEvent("lead_submit", { kind, ...(courseId ? { courseId } : {}) });
    }
  }, [state.ok, courseId, kind]);

  if (state.ok) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className={className}
      >
        <div className="rounded-2xl border border-green-600/30 bg-green-600/5 p-6 text-center">
          <p className="text-lg font-semibold">Заявка отправлена!</p>
          <p className="mt-1 text-sm text-foreground/70">
            {isB2b
              ? "Свяжемся в ближайшее время, посчитаем стоимость и выставим счёт."
              : "Мы свяжемся с вами в ближайшее время и расскажем, как начать обучение."}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <form action={formAction} className={className}>
      {courseId ? <input type="hidden" name="courseId" value={courseId} /> : null}
      <input type="hidden" name="kind" value={kind} />
      <div className="space-y-1.5">
        <Label htmlFor="lead-name">Имя</Label>
        <Input id="lead-name" name="name" placeholder="Как к вам обращаться" />
      </div>
      {isB2b ? (
        <>
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="lead-company">Организация</Label>
            <Input
              id="lead-company"
              name="company"
              placeholder="Название компании"
            />
          </div>
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="lead-seats">Сколько сотрудников обучаем</Label>
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
        <Label htmlFor="lead-contact">Телефон, WhatsApp или e-mail *</Label>
        <Input
          id="lead-contact"
          name="contact"
          required
          placeholder="+7 700 000 00 00"
        />
      </div>
      <div className="mt-3 space-y-1.5">
        <Label htmlFor="lead-message">Комментарий</Label>
        <Input
          id="lead-message"
          name="message"
          placeholder={isB2b ? "Отрасль, задачи обучения" : "Какой курс интересует"}
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
          Я согласен(-на) на обработку моих персональных данных на условиях{" "}
          <Link href="/privacy" className="underline hover:text-brand">
            Политики обработки персональных данных
          </Link>{" "}
          (включая трансграничную передачу) и принимаю условия{" "}
          <Link href={isB2b ? "/offer-b2b" : "/offer"} className="underline hover:text-brand">
            {isB2b ? "публичной оферты для организаций" : "публичной оферты"}
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
        {isPending ? "Отправляем…" : isB2b ? "Получить расчёт" : "Оставить заявку"}
      </Button>
    </form>
  );
}
