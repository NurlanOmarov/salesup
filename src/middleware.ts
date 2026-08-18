import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Middleware использует ТОЛЬКО edge-safe authConfig (без Prisma/argon2).
// Гейтинг маршрутов — в callbacks.authorized.
export default NextAuth(authConfig).auth;

export const config = {
  // Исключаем статику, изображения, favicon, robots/sitemap; остальное — через authorized.
  // /api/auth тоже исключён: на нём middleware Auth.js ставил второй cookie
  // callback-url со значением https://0.0.0.0:3000, перебивавший host-based —
  // из-за этого домены не могли держать собственные сессии (мультидомен,
  // docs/MULTI-DOMAIN-PLAN.md). Там работает только route-handler, он host-aware.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|webp|ico|mp4|webm|glb|gltf|mp3)$).*)",
  ],
};
