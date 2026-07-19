import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/85 text-white backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="" width={36} height={36} className="size-9" priority />
          <span className="flex flex-col leading-tight">
            <span className="text-lg font-bold tracking-tight text-[#f4003a]">ACTIVE SALES</span>
            <span className="text-[11px] font-medium text-white/60">
              бизнес-тренинги для менеджеров
            </span>
          </span>
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
