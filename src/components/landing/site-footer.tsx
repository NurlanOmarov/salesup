import Image from "next/image";
import { Link } from "@/components/i18n/link";
import { getSupportContacts } from "@/lib/seo/settings";
import { REQUISITES } from "@/content/legal";
import { currentSite } from "@/lib/seo/site";
import { messagesFor } from "@/i18n/messages";
import { getLocale } from "@/i18n/server";
import { CountrySwitcher } from "@/components/landing/country-switcher";

export async function SiteFooter() {
  // Контакты — из SeoSettings (правятся в /admin/seo без деплоя).
  const { phone, phoneHref, whatsapp: wa, telegram: tg } = await getSupportContacts();
  const year = 2026;
  // Домен захода: подсветка страны в переключателе и честная строка «работаем в …».
  // Юрлицо и реквизиты при этом одни (РБ) — их показываем на всех доменах.
  const site = await currentSite();
  const t = messagesFor(await getLocale());

  return (
    <footer className="bg-slate-950 text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="" width={28} height={28} className="size-7" />
            <p className="text-lg font-bold text-brand">ACTIVE SALES</p>
          </div>
          <p className="mt-2 text-sm text-white/50">
            {t.footer.about}
            {site ? ` ${site.country}.` : ""}
          </p>
          {/*
            Сведения об исполнителе обязательны к доведению до потребителя
            (ст. 7 Закона РБ «О защите прав потребителей»). Правятся в
            src/content/legal/requisites.ts — там же, откуда их берут оферта
            и политика обработки ПДн.
          */}
          <address className="mt-3 space-y-0.5 text-xs not-italic leading-relaxed text-white/40">
            <p>{REQUISITES.legalName}</p>
            <p>{t.footer.unp} {REQUISITES.unp}</p>
            <p>{REQUISITES.address}</p>
          </address>
        </div>

        <div className="text-sm">
          <p className="font-semibold text-white/90">{t.footer.navigation}</p>
          <ul className="mt-2 space-y-1 text-white/60">
            <li>
              <Link href="/" className="transition-colors hover:text-brand-light">
                {t.footer.home}
              </Link>
            </li>
            <li>
              <Link href="/courses" className="transition-colors hover:text-brand-light">
                {t.footer.catalog}
              </Link>
            </li>
            <li>
              <Link href="/business" className="transition-colors hover:text-brand-light">
                {t.footer.business}
              </Link>
            </li>
            <li>
              <Link href="/login" className="transition-colors hover:text-brand-light">
                {t.footer.studentLogin}
              </Link>
            </li>
          </ul>
        </div>

        <div className="text-sm">
          <p className="font-semibold text-white/90">{t.footer.contacts}</p>
          <ul className="mt-2 space-y-1 text-white/60">
            <li>
              <a href={phoneHref} className="transition-colors hover:text-brand-light">
                {phone}
              </a>
            </li>
            {wa ? (
              <li>
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-brand-light"
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
                  className="transition-colors hover:text-brand-light"
                >
                  Telegram
                </a>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="text-sm">
          <p className="font-semibold text-white/90">{t.footer.documents}</p>
          <ul className="mt-2 space-y-1 text-white/60">
            <li>
              <Link href="/offer" className="transition-colors hover:text-brand-light">
                {t.footer.offer}
              </Link>
            </li>
            <li>
              <Link
                href="/offer-b2b"
                className="transition-colors hover:text-brand-light"
              >
                {t.footer.offerB2b}
              </Link>
            </li>
            <li>
              <Link
                href="/privacy"
                className="transition-colors hover:text-brand-light"
              >
                {t.footer.privacy}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="space-y-2 border-t border-white/10 py-4 text-center text-xs text-white/60">
        <CountrySwitcher currentHost={site?.host ?? null} />
        <p>© {year} ACTIVE SALES. {t.footer.rights}</p>
      </div>
    </footer>
  );
}
