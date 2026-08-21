"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { SITE_HOSTS } from "@/lib/seo/site-hosts";
import { countryFlag } from "@/lib/analytics/format";

/**
 * Переключатель домена дашборда: «Все домены» + пилюля на каждый SITE_HOSTS.
 * Состояние — в URL (?site=), как и период (period-controls.tsx), чтобы страница-RSC
 * перечитывала данные и вид (домен+период) шарился ссылкой.
 */
export function SiteSwitch({ active }: { active: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function select(code: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (code === null) params.delete("site");
    else params.set("site", code);
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className={cn("inline-flex rounded-lg border border-foreground/10 bg-background p-0.5", isPending && "opacity-70")}>
      <button
        onClick={() => select(null)}
        className={cn(
          "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          active === null ? "bg-brand text-white" : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground",
        )}
      >
        Все домены
      </button>
      {SITE_HOSTS.map((s) => (
        <button
          key={s.code}
          onClick={() => select(s.code)}
          title={s.country.ru}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            active === s.code ? "bg-brand text-white" : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground",
          )}
        >
          {countryFlag(s.code)} {s.code}
        </button>
      ))}
    </div>
  );
}
