import { MessageCircle, Send, Phone, LifeBuoy } from "lucide-react";
import { getSupportContacts } from "@/lib/seo/settings";

/**
 * Контакты поддержки в кабинете (те же, что на лендинге/«забыли пароль»): WhatsApp,
 * Telegram, телефон владельца — из SeoSettings (правятся в /admin/seo без деплоя).
 * Для вопросов по доступу и оплате (онлайн-оплаты в MVP нет — D из CLAUDE.md).
 * `variant="card"` — секция в настройках; `variant="inline"` — компактно.
 */
function digits(s: string): string {
  return s.replace(/[^\d]/g, "");
}

export async function SupportContact({ variant = "card" }: { variant?: "card" | "inline" }) {
  const { phone, phoneHref, whatsapp: wa, telegram: tg } = await getSupportContacts();

  const links = [
    wa && {
      href: wa.startsWith("http") ? wa : `https://wa.me/${digits(wa)}`,
      label: "WhatsApp",
      icon: MessageCircle,
      cls: "text-emerald-600",
    },
    tg && {
      href: tg.startsWith("http") ? tg : `https://t.me/${tg.replace(/^@/, "")}`,
      label: "Telegram",
      icon: Send,
      cls: "text-sky-600",
    },
    phone && {
      href: phoneHref,
      label: phone,
      icon: Phone,
      cls: "text-amber-600",
    },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Phone; cls: string }[];

  const buttons = (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-foreground/10 px-3 py-2 text-sm font-medium transition-colors hover:bg-foreground/5"
        >
          <l.icon className={`size-4 ${l.cls}`} />
          {l.label}
        </a>
      ))}
    </div>
  );

  if (variant === "inline") return buttons;

  return (
    <section className="rounded-2xl border border-foreground/10 bg-background p-6">
      <div className="flex items-center gap-2">
        <LifeBuoy className="size-5 text-amber-600" />
        <h2 className="font-semibold">Поддержка</h2>
      </div>
      <p className="mt-1 text-sm text-foreground/60">
        Вопросы по доступу, оплате или продлению — напишите нам, ответим лично.
      </p>
      <div className="mt-4">{buttons}</div>
    </section>
  );
}
