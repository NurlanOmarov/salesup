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
];
const PUBLIC_EXACT = ["/"];

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
        // залогиненного со страницы /login уводим в кабинет
        if (isLoggedIn && pathname === "/login") {
          const dest = auth!.user.mustChangePassword
            ? "/change-password"
            : "/app";
          return NextResponse.redirect(new URL(dest, request.nextUrl));
        }
        return true;
      }

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
