import NextAuth from "next-auth";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { authConfig } from "@/auth.config";
import {
  stripLocale,
  localesForHost,
  hasLocaleVersion,
  LOCALE_HEADER,
  type ExtraLocale,
} from "@/i18n/routing";

// Middleware использует ТОЛЬКО edge-safe authConfig (без Prisma/argon2).
// Гейтинг маршрутов — в callbacks.authorized.
const { auth } = NextAuth(authConfig);

/**
 * Язык страницы: казахская версия живёт на `/kk/*`, внутри приложения маршрут
 * остаётся прежним, а выбранный язык уходит заголовком (src/i18n/server.ts).
 */
function withLocale(req: NextRequest) {
  const { locale, pathname } = stripLocale(req.nextUrl.pathname);
  if (!locale) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = pathname;

  // Язык доступен только на своём домене и только у переведённых страниц:
  // остальное уводим на русскую версию того же пути, чтобы не плодить адреса
  // с чужим языком внутри.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (
    !localesForHost(host).includes(locale) ||
    !hasLocaleVersion(pathname, locale as ExtraLocale)
  ) {
    return NextResponse.redirect(url);
  }

  const headers = new Headers(req.headers);
  headers.set(LOCALE_HEADER, locale);
  return NextResponse.rewrite(url, { request: { headers } });
}

// auth() типизирован под route-handler'ы, поэтому приводим к сигнатуре middleware.
type Middleware = (
  req: NextRequest,
  ctx: NextFetchEvent,
) => Response | Promise<Response | undefined> | undefined;

const gated = auth((req) => withLocale(req as unknown as NextRequest)) as unknown as Middleware;

/**
 * Пути, где нужен разбор сессии. Публичная витрина через Auth.js НЕ идёт: он
 * ставил бы на каждый анонимный запрос cookie csrf-token/callback-url, а ответ
 * с Set-Cookie nginx не кэширует — микрокэш витрины (deploy/proxy_cache_public.conf)
 * не работал. Плюс на публичных страницах не тратится расшифровка JWT.
 */
function needsSession(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/org" ||
    pathname.startsWith("/org/") ||
    pathname === "/change-password" ||
    pathname.startsWith("/change-password/") ||
    pathname.startsWith("/api/")
  );
}

export default function middleware(req: NextRequest, ctx: NextFetchEvent) {
  const { pathname } = stripLocale(req.nextUrl.pathname);
  return needsSession(pathname) ? gated(req, ctx) : withLocale(req);
}

export const config = {
  // Исключаем статику, изображения, favicon, robots/sitemap; остальное — через authorized.
  // /api/auth тоже исключён: middleware Auth.js ставил там второй cookie
  // callback-url со значением https://0.0.0.0:3000, перебивавший host-based
  // (мультидомен, docs/MULTI-DOMAIN-PLAN.md). Публичный адрес для этих роутов
  // восстанавливает сам обработчик — src/app/api/auth/[...nextauth]/route.ts.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|webp|ico|mp4|webm|glb|gltf|mp3)$).*)",
  ],
};
