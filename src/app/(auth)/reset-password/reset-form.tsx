"use client";

import { useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { resetPasswordAction, type ResetState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ResetState = {};

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, initialState);

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

      <h1 className="mt-6 text-2xl font-bold">Новый пароль</h1>
      <p className="mt-1 text-sm text-foreground/60">Придумайте пароль — минимум 8 символов.</p>

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="token" value={token} />
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
          <Label htmlFor="confirmPassword">Повторите пароль</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>

        {state.error ? (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Сохраняем…" : "Сохранить пароль"}
        </Button>
      </form>
    </motion.div>
  );
}
