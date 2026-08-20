import Image from "next/image";
import { Link } from "@/components/i18n/link";
import { buttonVariants } from "@/components/ui/button";
import { AudienceSwitch } from "@/components/landing/audience-switch";
import { LanguageSwitch } from "@/components/landing/language-switch";
import { messagesFor } from "@/i18n/messages";
import { getLocale } from "@/i18n/server";
import { localesForHost } from "@/i18n/routing";
import { headers } from "next/headers";

export async function SiteHeader() {
  const locale = await getLocale();
  const t = messagesFor(locale);
  // Языки этого домена: казахский есть только на .kz и только когда готов.
  const h = await headers();
  const locales = localesForHost(h.get("x-forwarded-host") ?? h.get("host"));
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/85 text-white backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-2 px-4 py-2">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Image src="/logo.png" alt="" width={36} height={36} className="size-9 shrink-0" priority />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="text-lg font-bold tracking-tight text-brand">ACTIVE SALES</span>
            <span className="hidden truncate text-[11px] font-medium text-white/60 sm:block">
              {t.header.tagline}
            </span>
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-2 sm:gap-4">
          {/* Регистр «Себе | Команде» — ссылки на / и /business (обе версии
              индексируются). Доступен с любой страницы, поэтому живёт в шапке. */}
          <AudienceSwitch onDark className="hidden sm:inline-flex" />
          <Link
            href="/courses"
            className="px-1.5 text-sm font-medium whitespace-nowrap text-white/70 transition-colors hover:text-white sm:px-2"
          >
            {t.header.courses}
          </Link>
          <LanguageSwitch locales={locales} />
          <Link
            href="/login"
            className={buttonVariants({ variant: "outline-light", size: "sm" })}
          >
            {t.header.login}
          </Link>
        </nav>
      </div>
    </header>
  );
}
