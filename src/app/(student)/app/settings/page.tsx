import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ProfileForm, PasswordForm, type ProfileInitial } from "./settings-forms";
import { ThemeToggle } from "@/components/theme-toggle";
import { SupportContact } from "@/components/student/support-contact";
import { REQUISITES } from "@/content/legal";

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
      termsAcceptedAt: true,
      termsVersion: true,
    },
  });

  const acceptedOn = user?.termsAcceptedAt
    ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "long" }).format(
        user.termsAcceptedAt,
      )
    : "";

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

      {/*
        Документы и отметка об их принятии: ученик должен видеть, какую редакцию
        оферты он принял (п. 12.2 оферты) и как реализовать права субъекта ПДн
        (раздел 8 политики, Закон РБ № 99-З).
      */}
      <section className="mt-5 rounded-2xl border border-foreground/10 bg-background p-6">
        <h2 className="font-semibold">Документы</h2>
        <p className="mt-0.5 text-sm text-foreground/50">
          {user?.termsAcceptedAt
            ? `Вы приняли редакцию ${user.termsVersion ?? "—"} ${acceptedOn}.`
            : "Условия принимаются при первом входе в кабинет."}
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          <li>
            <Link href="/offer" className="text-brand hover:underline">
              Публичная оферта
            </Link>
          </li>
          <li>
            <Link href="/privacy" className="text-brand hover:underline">
              Политика в отношении обработки персональных данных
            </Link>
          </li>
        </ul>
        <p className="mt-4 text-xs text-foreground/50">
          Заявление об изменении или удалении своих персональных данных, а также
          об отзыве согласия направляйте на {REQUISITES.email}. Срок рассмотрения —
          15 дней (5 рабочих дней по заявлению о предоставлении информации об
          обработке).
        </p>
      </section>

      <div className="mt-5">
        <SupportContact />
      </div>
    </main>
  );
}
