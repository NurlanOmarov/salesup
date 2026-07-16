"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { writeAdminLog } from "@/lib/admin/log";
import { safeAction } from "@/lib/safe-action";
import { certificateNumber } from "@/lib/certificates/eligibility";

/**
 * Пометить сертификат выданным (владелец изготовил документ вне системы и выслал
 * ученику). Присваивает номер и дату выдачи. ФИО в системе не хранится (правило 9).
 */
export const markCertificateIssuedAction = safeAction(
  { schema: z.object({ id: z.string().min(1) }), auth: "owner" },
  async (input, { session }) => {
    const cert = await db.certificate.findUnique({
      where: { id: input.id },
      select: { id: true, status: true, number: true },
    });
    if (!cert) throw new Error("Сертификат не найден");
    if (cert.status === "ISSUED") return { ok: true as const };

    const issuedAt = new Date();
    const number =
      cert.number ??
      certificateNumber(issuedAt.getFullYear(), (await db.certificate.count()) + 1);

    await db.certificate.update({
      where: { id: input.id },
      data: { status: "ISSUED", issuedAt, number },
    });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "certificate.issue",
      meta: { certificateId: input.id, number },
    });

    revalidatePath("/admin/certificates");
    return { ok: true as const };
  },
);
