import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ProfileForm, PasswordForm, type ProfileInitial } from "./settings-forms";
import { ThemeToggle } from "@/components/theme-toggle";
import { SupportContact } from "@/components/student/support-contact";

export const metadata: Metadata = {
  title: "Настройки",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireUser();

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
      industry: true,
      position: true,
      subtitleLang: true,
      weeklyGoal: true,
    },
  });

  const initial: ProfileInitial = {
    name: user?.name ?? "",
    industry: user?.industry ?? "",
    position: user?.position ?? "",
    subtitleLang: user?.subtitleLang ?? "",
    weeklyGoal: user?.weeklyGoal ?? 3,
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">Настройки</h1>

      <section className="mt-6 rounded-2xl border border-foreground/10 bg-background p-6">
        <h2 className="font-semibold">Профиль</h2>
        <p className="mt-0.5 text-sm text-foreground/50">Логин: {user?.email}</p>
        <div className="mt-4">
          <ProfileForm initial={initial} />
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-foreground/10 bg-background p-6">
        <h2 className="font-semibold">Оформление</h2>
        <p className="mt-0.5 text-sm text-foreground/50">Тема интерфейса кабинета.</p>
        <div className="mt-4">
          <ThemeToggle />
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-foreground/10 bg-background p-6">
        <h2 className="font-semibold">Смена пароля</h2>
        <div className="mt-4">
          <PasswordForm />
        </div>
      </section>

      <div className="mt-5">
        <SupportContact />
      </div>
    </main>
  );
}
