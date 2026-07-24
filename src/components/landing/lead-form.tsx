"use client";

import { useActionState, useEffect } from "react";
import { motion } from "framer-motion";
import { createLeadAction, type LeadFormState } from "@/app/(marketing)/actions";
import { trackEvent } from "@/lib/analytics/track";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LeadFormState = {};

/** Форма заявки (без онлайн-оплаты): имя + контакт + сообщение → Lead. */
export function LeadForm({
  courseId,
  className,
}: {
  courseId?: string;
  className?: string;
}) {
  const [state, formAction, isPending] = useActionState(
    createLeadAction,
    initialState,
  );

  // Конверсия в счётчики — только по факту успешной отправки (маркетинговый слой,
  // D-002). courseId кладём в параметр, чтобы видеть, какой курс приносит заявки.
  useEffect(() => {
    if (state.ok) trackEvent("lead_submit", courseId ? { courseId } : {});
  }, [state.ok, courseId]);

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
            Мы свяжемся с вами в ближайшее время и расскажем, как начать обучение.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <form action={formAction} className={className}>
      {courseId ? <input type="hidden" name="courseId" value={courseId} /> : null}
      <div className="space-y-1.5">
        <Label htmlFor="lead-name">Имя</Label>
        <Input id="lead-name" name="name" placeholder="Как к вам обращаться" />
      </div>
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
          placeholder="Какой курс интересует"
        />
      </div>

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
        {isPending ? "Отправляем…" : "Оставить заявку"}
      </Button>
      <p className="mt-2 text-center text-xs text-foreground/50">
        Нажимая кнопку, вы соглашаетесь с обработкой персональных данных.
      </p>
    </form>
  );
}
