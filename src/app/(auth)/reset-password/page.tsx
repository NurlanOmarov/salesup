import type { Metadata } from "next";
import Link from "next/link";
import { findValidResetToken } from "@/lib/auth/password-reset";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = {
  title: "Новый пароль",
  robots: { index: false },
  // Токен в адресе: не отдаём его сторонним сайтам в Referer.
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

/**
 * Страница по ссылке из письма. Здесь токен только ПРОВЕРЯЕТСЯ, а не гасится:
 * почтовые сканеры (Outlook Safe Links, антивирусы) открывают ссылки заранее, и
 * если бы просмотр сжигал токен, человек получал бы уже мёртвую ссылку.
 * Гасит его только сохранение нового пароля.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = token ? await findValidResetToken(token) : null;

  if (!token || !valid) {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-foreground/10 p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold">Ссылка не работает</h1>
        <p className="mt-2 text-sm text-foreground/65">
          Она уже использована или устарела: ссылка действует один час и срабатывает один раз.
          Запросите новую — это займёт минуту.
        </p>
        <Link
          href="/forgot-password"
          className="mt-5 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong"
        >
          Запросить новую ссылку
        </Link>
      </div>
    );
  }

  return <ResetForm token={token} />;
}
