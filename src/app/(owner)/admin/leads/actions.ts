"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/safe-action";
import { db } from "@/lib/db";
import { writeAdminLog } from "@/lib/admin/log";

/** Обновление статуса/комментария заявки с лендинга (S5.1). Только OWNER. */
export const updateLeadAction = safeAction(
  {
    schema: z.object({
      leadId: z.string().min(1),
      status: z.enum(["NEW", "CONTACTED", "PAID", "DECLINED"]),
      comment: z.string().trim().optional(),
    }),
    auth: "owner",
  },
  async ({ leadId, status, comment }, { session }) => {
    await db.lead.update({
      where: { id: leadId },
      data: { status, comment: comment || null },
    });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "lead.update",
      meta: { leadId, status },
    });

    revalidatePath("/admin/leads");
    return { ok: true };
  },
);
