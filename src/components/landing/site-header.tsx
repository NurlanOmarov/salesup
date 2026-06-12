import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-foreground/10 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          SalesAcademy
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/courses"
            className="px-2 text-sm font-medium text-foreground/70 hover:text-foreground"
          >
            Курсы
          </Link>
          <Link
            href="/login"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Войти
          </Link>
        </nav>
      </div>
    </header>
  );
}
