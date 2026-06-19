import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Middleware использует ТОЛЬКО edge-safe authConfig (без Prisma/argon2).
// Гейтинг маршрутов — в callbacks.authorized.
export default NextAuth(authConfig).auth;

export const config = {
  // исключаем статику, изображения, favicon, robots/sitemap; остальное — через authorized
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|webp|ico|mp4|webm|glb|gltf|mp3)$).*)",
  ],
};
