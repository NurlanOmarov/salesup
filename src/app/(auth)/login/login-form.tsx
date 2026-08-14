"use client";

import { useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { loginAction, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = {};

export function LoginForm({
  callbackUrl,
  supportContact,
}: {
  callbackUrl?: string;
  supportContact?: string;
}) {
  const [state, formAction, isPending] = useActionState(
    loginAction,
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

      <h1 className="mt-6 text-2xl font-bold">Вход</h1>
      <p className="mt-1 text-sm text-foreground/60">
        Введите выданные администратором логин и пароль.
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        {callbackUrl ? (
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="identity">Логин или e-mail</Label>
          <Input
            id="identity"
            name="identity"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            placeholder="you@example.by или acme-0042"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Пароль</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        {state.error ? (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Входим…" : "Войти"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-foreground/50">
        Забыли пароль?{" "}
        {supportContact ? (
          <a href={supportContact} className="underline hover:text-foreground">
            обратитесь к администратору
          </a>
        ) : (
          <span>обратитесь к администратору</span>
        )}
      </p>

      <Link
        href="/"
        className="mt-6 flex items-center justify-center gap-1.5 text-sm text-foreground/60 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        На главную
      </Link>
    </motion.div>
  );
}
