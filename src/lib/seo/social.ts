import type { SeoSettings } from "@prisma/client";

/**
 * Соцсети школы. Отдельный модуль без server-only: значения приходят из
 * SeoSettings, но сами функции чистые — их используют и разметка организации
 * (sameAs), и футер, и тесты.
 */
export function socialLinks(s: SeoSettings): string[] {
  return [
    s.socialInstagram,
    s.socialTelegram,
    s.socialYoutube,
    s.socialTiktok,
    s.socialFacebook,
    s.socialLinkedin,
    s.socialVk,
  ].filter((v): v is string => Boolean(v));
}

/** Соцсети для футера: ссылка + подпись + какой значок рисовать. */
export function socialProfiles(s: SeoSettings) {
  return (
    [
      { href: s.socialInstagram, label: "Instagram", icon: "instagram" as const },
      { href: s.socialYoutube, label: "YouTube", icon: "youtube" as const },
      { href: s.socialFacebook, label: "Facebook", icon: "facebook" as const },
      { href: s.socialVk, label: "ВКонтакте", icon: "vk" as const },
      { href: s.socialTiktok, label: "TikTok", icon: "tiktok" as const },
      { href: s.socialLinkedin, label: "LinkedIn", icon: "linkedin" as const },
      { href: s.socialTelegram, label: "Telegram", icon: "telegram" as const },
    ] as const
  )
    .filter((p): p is typeof p & { href: string } => Boolean(p.href))
    .map((p) => ({ href: p.href, label: p.label, icon: p.icon }));
}
