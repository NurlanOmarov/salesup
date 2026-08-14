"use client";

import { useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  changePasswordAction,
  type ChangePasswordState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ChangePasswordState = {};

export function ChangePasswordForm({ needsTerms }: { needsTerms: boolean }) {
  const [state, formAction, isPending] = useActionState(
    changePasswordAction,
    initialState,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-sm rounded-2xl border border-foreground/10 p-6 shadow-sm sm:p-8"
    >
      <Link
        href="/"
        className="flex items-center gap-2 text-lg font-bold tracking-tight"
      >
        <Image src="/logo.png" alt="" width={24} height={24} className="size-6" />
        <span className="text-brand">ACTIVE SALES</span>
      </Link>

      <h1 className="mt-6 text-2xl font-bold">Смена пароля</h1>
      <p className="mt-1 text-sm text-foreground/60">
        Это ваш первый вход. Задайте постоянный пароль, чтобы продолжить.
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="currentPassword">Текущий (временный) пароль</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="newPassword">Новый пароль</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Повторите новый пароль</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>

        {/*
          Первый вход — момент заключения договора (ст. 408 ГК РБ) и дачи согласия
          на обработку ПДн (Закон № 99-З). Отметка обязательна, факт и версия
          редакции сохраняются в User.termsAcceptedAt/termsVersion. Показываем
          только тем, кто ещё не принимал документы.
        */}
        {needsTerms ? (
          <label className="flex items-start gap-2.5 text-xs text-foreground/60">
            <input
              type="checkbox"
              name="terms"
              value="on"
              required
              className="mt-0.5 size-4 shrink-0 accent-brand"
            />
            <span>
              Я принимаю условия{" "}
              <Link
                href="/offer"
                target="_blank"
                className="underline hover:text-brand"
              >
                публичной оферты
              </Link>{" "}
              и даю согласие на обработку персональных данных на условиях{" "}
              <Link
                href="/privacy"
                target="_blank"
                className="underline hover:text-brand"
              >
                Политики
              </Link>
              , включая трансграничную передачу.
            </span>
          </label>
        ) : null}

        {state.error ? (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Сохраняем…" : "Сохранить и продолжить"}
        </Button>
      </form>
    </motion.div>
  );
}
