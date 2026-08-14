"use client";

import { useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, ShieldCheck } from "lucide-react";
import { joinAction, type JoinState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: JoinState = {};

/**
 * Регистрация работника по коду от своей компании. Полей ровно три — код и
 * пароль дважды: ни имени, ни почты мы не спрашиваем и спрашивать не будем.
 */
export function JoinForm({ defaultCode }: { defaultCode?: string }) {
  const [state, formAction, isPending] = useActionState(joinAction, initialState);

  // Успех: показываем выданный логин — его нужно запомнить для следующих входов.
  if (state.login) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-2xl border border-emerald-600/30 bg-emerald-500/5 p-6 sm:p-8"
      >
        <div className="flex items-center gap-2 text-emerald-700">
          <Check className="size-5" />
          <p className="font-semibold">Доступ открыт</p>
        </div>
        <p className="mt-3 text-sm text-foreground/70">
          Запишите свой логин — он понадобится для входа в следующий раз:
        </p>
        <p className="mt-2 rounded-lg border border-foreground/10 bg-background px-3 py-2 text-center font-mono text-lg">
          {state.login}
        </p>
        <Link
          href="/app"
          className="mt-5 block rounded-lg bg-amber-500 px-4 py-2.5 text-center text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
        >
          Начать обучение
        </Link>
      </motion.div>
    );
  }

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

      <h1 className="mt-6 text-2xl font-bold">Регистрация по коду</h1>
      <p className="mt-1 text-sm text-foreground/60">
        Введите код, который выдала ваша компания, и придумайте пароль.
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="code">Код доступа</Label>
          <Input
            id="code"
            name="code"
            required
            defaultValue={defaultCode}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="ABCD2345"
            className="font-mono tracking-widest"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Придумайте пароль</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="passwordConfirm">Повторите пароль</Label>
          <Input
            id="passwordConfirm"
            name="passwordConfirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>

        <label className="flex items-start gap-2 text-xs text-foreground/65">
          <input
            type="checkbox"
            name="terms"
            required
            className="mt-0.5 size-4 shrink-0 rounded border-foreground/25"
          />
          <span>
            Согласен с{" "}
            <Link href="/privacy" className="underline hover:text-foreground" target="_blank">
              политикой обработки персональных данных
            </Link>
          </span>
        </label>

        {state.error ? (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Создаём доступ…" : "Начать обучение"}
        </Button>
      </form>

      <p className="mt-5 flex items-start gap-2 rounded-lg bg-foreground/[0.03] p-3 text-xs text-foreground/60">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
        <span>
          Мы не спрашиваем фамилию, почту и телефон: обучение идёт под условным
          обозначением, которое платформа выдаёт автоматически.
        </span>
      </p>

      <p className="mt-4 text-center text-sm text-foreground/50">
        Уже регистрировались?{" "}
        <Link href="/login" className="underline hover:text-foreground">
          Войти
        </Link>
      </p>
    </motion.div>
  );
}
