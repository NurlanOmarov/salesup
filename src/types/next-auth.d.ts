import type { OrgRole, UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      mustChangePassword: boolean;
      /**
       * B2B: организация пользователя и его роль в ней. Нужны middleware (edge,
       * без БД) для грубого гейта зоны /org и навигации. Тонкие проверки прав
       * ВСЕГДА идут в БД (lib/org/guards.ts) — членство могло измениться после
       * выпуска токена.
       */
      orgId?: string | null;
      orgRole?: OrgRole | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    mustChangePassword: boolean;
    orgId?: string | null;
    orgRole?: OrgRole | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    role: UserRole;
    mustChangePassword: boolean;
    orgId?: string | null;
    orgRole?: OrgRole | null;
  }
}
