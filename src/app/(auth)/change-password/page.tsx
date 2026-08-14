import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = {
  title: "Смена пароля",
  robots: { index: false },
};

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Отметку об акцепте оферты показываем только тем, кто ещё не принимал
  // документы (смена пароля из настроек второй раз согласие не переспрашивает).
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { termsAcceptedAt: true },
  });

  return <ChangePasswordForm needsTerms={!user?.termsAcceptedAt} />;
}
