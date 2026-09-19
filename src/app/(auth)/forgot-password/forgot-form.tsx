"use client";

import { useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, MailCheck } from "lucide-react";
import { requestPasswordResetAction, type ForgotState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ForgotState = {};

export function ForgotForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-sm rounded-2xl border border-foreground/10 p-6 shadow-sm sm:p-8"
    >
      <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
        <Image src="/logo.png" alt="" width={24} height={24} className="size-6" />
        <span className="text-brand">ACTIVE SALES</span>
      </Link>

      <h1 className="mt-6 text-2xl font-bold">Восстановление пароля</h1>

      {state.sent ? (
        <div role="status" className="mt-4 space-y-3 text-sm">
          <p className="flex items-start gap-2 text-emerald-700">
            <MailCheck className="mt-0.5 size-5 shrink-0" />
            <span>
              Если такой адрес есть в системе, мы отправили на него письмо со ссылкой для
              нового пароля. Ссылка действует один час.
            </span>
          </p>
          <p className="text-foreground/60">
            Письма нет? Проверьте папку «Спам» и убедитесь, что адрес введён верно. Через
            минуту можно запросить письмо ещё раз.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-foreground/60">
            Укажите e-mail, с которым вы входите, — мы пришлём ссылку для смены пароля.
          </p>
          <form action={formAction} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                placeholder="you@example.by"
              />
            </div>

            {state.error ? (
              <p role="alert" className="text-sm text-red-600">
                {state.error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Отправляем…" : "Прислать ссылку"}
            </Button>
          </form>

          <p className="mt-4 text-xs text-foreground/50">
            Вы сотрудник организации и входите по логину вида <span className="font-mono">acme-0042</span>?
            У вас нет почты в системе — новый пароль выдаст ответственный вашей компании.
          </p>
        </>
      )}

      <Link
        href="/login"
        className="mt-6 flex items-center justify-center gap-1.5 text-sm text-foreground/60 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Вернуться ко входу
      </Link>
    </motion.div>
  );
}
