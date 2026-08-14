import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { identityWhere, parseIdentity } from "@/lib/auth/identity";

const credentialsSchema = z.object({
  /** e-mail или логин работника организации — разбирается в parseIdentity. */
  identity: z.string().min(1),
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
      credentials: { identity: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const identity = parseIdentity(parsed.data.identity);
        if (!identity) return null;

        const user = await db.user.findUnique({
          where: identityWhere(identity),
        });
        if (!user || !user.passwordHash || user.deletedAt) return null;

        const ok = await verifyPassword(user.passwordHash, parsed.data.password);
        if (!ok) return null;

        // Членство в организации кладём в токен для навигации и edge-гейта /org.
        // Права проверяются заново в БД при каждом действии (lib/org/guards.ts).
        const membership = await db.orgMembership.findFirst({
          where: { userId: user.id, isActive: true },
          select: { orgId: true, role: true },
          orderBy: { joinedAt: "asc" },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          orgId: membership?.orgId ?? null,
          orgRole: membership?.role ?? null,
        };
      },
    }),
  ],
});
