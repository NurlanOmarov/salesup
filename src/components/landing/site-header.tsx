import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/85 text-white backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <svg viewBox="0 0 64 64" className="size-7" aria-hidden>
            <rect width="64" height="64" rx="14" fill="#f59e0b" />
            <path
              d="M20 44 L32 20 L44 44"
              fill="none"
              stroke="#020617"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          SalesAcademy
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/courses"
            className="px-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            Курсы
          </Link>
          <Link
            href="/login"
            className={buttonVariants({ variant: "outline-light", size: "sm" })}
          >
            Войти
          </Link>
        </nav>
      </div>
    </header>
  );
}
