import Link from "next/link";

export function SiteFooter() {
  const wa = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
  const tg = process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM;
  const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE;
  const year = 2026;

  return (
    <footer className="bg-slate-950 text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-lg font-bold">ACTIVE SALES</p>
          <p className="mt-2 text-sm text-white/50">
            Онлайн-курсы по продажам с AI-наставником. Казахстан.
          </p>
        </div>

        <div className="text-sm">
          <p className="font-semibold text-white/90">Навигация</p>
          <ul className="mt-2 space-y-1 text-white/60">
            <li>
              <Link href="/" className="transition-colors hover:text-amber-400">
                Главная
              </Link>
            </li>
            <li>
              <Link href="/courses" className="transition-colors hover:text-amber-400">
                Каталог курсов
              </Link>
            </li>
            <li>
              <Link href="/login" className="transition-colors hover:text-amber-400">
                Вход для учеников
              </Link>
            </li>
          </ul>
        </div>

        <div className="text-sm">
          <p className="font-semibold text-white/90">Контакты</p>
          <ul className="mt-2 space-y-1 text-white/60">
            {phone ? (
              <li>
                <a
                  href={`tel:${phone.replace(/\s/g, "")}`}
                  className="transition-colors hover:text-amber-400"
                >
                  {phone}
                </a>
              </li>
            ) : null}
            {wa ? (
              <li>
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-amber-400"
                >
                  WhatsApp
                </a>
              </li>
            ) : null}
            {tg ? (
              <li>
                <a
                  href={tg}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-amber-400"
                >
                  Telegram
                </a>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="text-sm">
          <p className="font-semibold text-white/90">Документы</p>
          <ul className="mt-2 space-y-1 text-white/60">
            <li>
              <Link href="/offer" className="transition-colors hover:text-amber-400">
                Публичная оферта
              </Link>
            </li>
            <li>
              <Link
                href="/privacy"
                className="transition-colors hover:text-amber-400"
              >
                Политика конфиденциальности
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/60">
        © {year} ACTIVE SALES. Все права защищены.
      </div>
    </footer>
  );
}
