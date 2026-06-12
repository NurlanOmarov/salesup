import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Полный конфиг Auth.js (Node): добавляет Credentials-провайдер к edge-safe authConfig.
 * Перебор паролей и запись попыток — в server action логина (lib + login-attempts),
 * authorize выполняет только проверку пароля (argon2id).
 */
export const {
  handlers,
  auth,
  signIn,
  signOut,
  unstable_update: updateSession,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user || !user.passwordHash || user.deletedAt) return null;

        const ok = await verifyPassword(user.passwordHash, parsed.data.password);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
});
