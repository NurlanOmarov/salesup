import type { Metadata } from "next";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = {
  title: "Восстановление пароля",
  robots: { index: false },
};

export default function ForgotPasswordPage() {
  return <ForgotForm />;
}
