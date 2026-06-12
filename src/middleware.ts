import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Middleware использует ТОЛЬКО edge-safe authConfig (без Prisma/argon2).
// Гейтинг маршрутов — в callbacks.authorized.
export default NextAuth(authConfig).auth;

export const config = {
  // исключаем статику, изображения и favicon; всё остальное проходит через authorized
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
