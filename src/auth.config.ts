import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

/** Поля, которые мы кладём в JWT (augmentation в callback-параметрах ненадёжна в beta). */
type AppToken = {
  uid?: string;
  role?: UserRole;
  mustChangePassword?: boolean;
};

/**
 * Edge-safe конфиг Auth.js (без БД и нативных модулей — используется в middleware).
 * Полный конфиг с Credentials-провайдером (argon2 + Prisma, только Node) — в src/auth.ts.
 *
 * Cookie сессии: фиксированное имя (без префикса __Secure-), флаг Secure управляется
 * AUTH_COOKIE_INSECURE — на временном VPS по IP без TLS ставится true (D-007).
 */
const cookieInsecure = process.env.AUTH_COOKIE_INSECURE === "true";

const PUBLIC_PREFIXES = [
  "/login",
  "/courses",
  "/verify",
  "/offer",
  "/privacy",
  "/api/health",
  "/api/icon", // PWA-иконки (генерятся без авторизации, на них ссылается манифест)
  "/api/og-image", // кастомные OG-картинки (публичны по природе — их читают соцсети)
  "/api/cover", // обложки курсов в публичном каталоге — читаются анонимно
  "/api/track", // счётчик page.view: шлётся анонимными посетителями лендинга (D-002)
];
// PWA: манифест, service worker и offline-страница должны быть доступны без входа.
const PUBLIC_EXACT = ["/", "/manifest.webmanifest", "/sw.js", "/offline.html"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  if (pathname.startsWith("/api/auth")) return true; // эндпоинты Auth.js
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  cookies: {
    sessionToken: {
      name: "salesup.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: !cookieInsecure,
      },
    },
  },
  providers: [], // добавляются в src/auth.ts (Node-окружение)
  logger: {
    error(error) {
      // Неверный пароль (CredentialsSignin) — штатная ситуация, не шумим в логах.
      const e = error as { name?: string; type?: string };
      const tag = e?.type ?? e?.name;
      if (tag === "CredentialsSignin" || tag === "CallbackRouteError") return;
      console.error(error);
    },
  },
  callbacks: {
    jwt({ token, user, trigger, session }) {
      const t = token as AppToken;
      if (user) {
        t.uid = user.id;
        t.role = user.role;
        t.mustChangePassword = user.mustChangePassword;
      }
      // принудительная смена пароля завершена → обновляем токен (unstable_update)
      if (
        trigger === "update" &&
        (session as { mustChangePassword?: boolean } | undefined)
          ?.mustChangePassword === false
      ) {
        t.mustChangePassword = false;
      }
      return token;
    },
    session({ session, token }) {
      const t = token as AppToken;
      if (t.uid) session.user.id = t.uid;
      if (t.role) session.user.role = t.role;
      session.user.mustChangePassword = t.mustChangePassword ?? false;
      return session;
    },
    /**
     * Гейтинг маршрутов в middleware. Возвращает true/false или Response-редирект.
     * Логика доступа к контенту — отдельно в lib/access.ts (правило 1); здесь только
     * грубая защита зон /app и /admin и форс-смены пароля.
     */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const token = auth?.user;
      const isLoggedIn = !!token;

      // статика и публичные страницы — всегда
      if (isPublicPath(pathname)) {
        // залогиненного со страницы /login уводим по назначению (роль учитывается)
        if (isLoggedIn && pathname === "/login") {
          const dest = auth!.user.mustChangePassword
            ? "/change-password"
            : auth!.user.role === "OWNER"
              ? "/admin"
              : "/app";
          return NextResponse.redirect(new URL(dest, request.nextUrl));
        }
        return true;
      }

      // API-маршруты отвечают кодами (JSON), а не редиректом на HTML-логин.
      // Тонкую проверку доступа/роли делает сам роут через lib/access.
      if (pathname.startsWith("/api/")) {
        if (!isLoggedIn) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return true;
      }

      // Приватные зоны известны точно: /app, /admin, /change-password. Всё прочее
      // неизвестное — пропускаем в приложение: catch-all (marketing) отдаст честный
      // 404 (журнал битых ссылок) или 308-редирект. Редиректить рандомные URL на
      // логин нельзя — ломает SEO и журнал 404. Контент это не раскрывает: данные
      // защищаются в самих зонах и lib/access (правило 1).
      const isProtected =
        pathname === "/app" ||
        pathname.startsWith("/app/") ||
        pathname === "/admin" ||
        pathname.startsWith("/admin/") ||
        pathname === "/change-password" ||
        pathname.startsWith("/change-password/");
      if (!isProtected) return true;

      // приватные зоны
      if (!isLoggedIn) {
        const url = new URL("/login", request.nextUrl);
        url.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(url);
      }

      // форс-смена временного пароля — до любого другого действия
      if (auth!.user.mustChangePassword && pathname !== "/change-password") {
        return NextResponse.redirect(new URL("/change-password", request.nextUrl));
      }

      // зона владельца
      if (pathname.startsWith("/admin") && auth!.user.role !== "OWNER") {
        return NextResponse.redirect(new URL("/app", request.nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
