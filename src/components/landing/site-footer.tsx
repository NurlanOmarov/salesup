import Link from "next/link";

export function SiteFooter() {
  const wa = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
  const tg = process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM;
  const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE;
  const year = 2026;

  return (
    <footer className="border-t border-foreground/10">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
        <div>
          <p className="text-lg font-bold">SalesAcademy</p>
          <p className="mt-2 text-sm text-foreground/60">
            Онлайн-курсы по продажам с AI-наставником. Казахстан.
          </p>
        </div>

        <div className="text-sm">
          <p className="font-semibold">Контакты</p>
          <ul className="mt-2 space-y-1 text-foreground/70">
            {phone ? (
              <li>
                <a href={`tel:${phone.replace(/\s/g, "")}`}>{phone}</a>
              </li>
            ) : null}
            {wa ? (
              <li>
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
              </li>
            ) : null}
            {tg ? (
              <li>
                <a href={tg} target="_blank" rel="noopener noreferrer">
                  Telegram
                </a>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="text-sm">
          <p className="font-semibold">Документы</p>
          <ul className="mt-2 space-y-1 text-foreground/70">
            <li>
              <Link href="/offer">Публичная оферта</Link>
            </li>
            <li>
              <Link href="/privacy">Политика конфиденциальности</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-foreground/10 py-4 text-center text-xs text-foreground/50">
        © {year} SalesAcademy. Все права защищены.
      </div>
    </footer>
  );
}
