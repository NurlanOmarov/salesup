import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Вход",
  robots: { index: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const supportContact =
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ||
    process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM;

  return (
    <LoginForm callbackUrl={callbackUrl} supportContact={supportContact} />
  );
}
