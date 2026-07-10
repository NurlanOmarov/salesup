"use server";

import { z } from "zod";
import { safeAction } from "@/lib/safe-action";
import { db } from "@/lib/db";

/** Отметить, что ученик прошёл (или пропустил) онбординг-тур кабинета. */
export const completeOnboardingAction = safeAction(
  {
    schema: z.object({}),
    auth: "user",
  },
  async (_input, { session }) => {
    await db.user.update({
      where: { id: session!.user.id },
      data: { onboardedAt: new Date() },
    });
    return { ok: true };
  },
);
