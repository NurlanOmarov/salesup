import { db } from "@/lib/db";
import { env } from "@/env";
import { log } from "@/lib/log";
import { storage } from "@/lib/storage";
import { certificateEmail } from "./notify.js";

/**
 * Отправка PDF сертификата письмом (обработчик задачи `certificate.email`).
 * Получатель: у работника организации — ответственный представитель клиента
 * (Organization.contactEmail), у розничного ученика — его e-mail. Адрес не
 * логируем (правило 9); куда ушло — сохраняем в Certificate.emailedTo, чтобы
 * владелец видел это в админке.
 */
export async function sendCertificateEmail(certificateId: string): Promise<void> {
  const cert = await db.certificate.findUnique({
    where: { id: certificateId },
    select: {
      id: true,
      userId: true,
      status: true,
      number: true,
      holderName: true,
      pdfKey: true,
      verifyHash: true,
      emailedAt: true,
      course: { select: { title: true } },
      user: { select: { email: true } },
    },
  });
  if (!cert || cert.status !== "ISSUED" || !cert.pdfKey || !cert.number || !cert.holderName) {
    throw new Error("certificate.email: сертификат не выпущен");
  }
  if (cert.emailedAt) return;

  const membership = await db.orgMembership.findFirst({
    where: { userId: cert.userId },
    select: { label: true, org: { select: { name: true, contactEmail: true } } },
  });
  const to = membership ? membership.org.contactEmail : cert.user.email;
  if (!to) {
    // Некому слать (у клиента не указан e-mail ответственного) — не ретраим:
    // сертификат доступен в кабинете, владелец получил уведомление в Telegram.
    log.warn({ certificateId }, "certificate.email: нет адреса получателя");
    return;
  }
  if (!env.EMAIL_ENABLED) {
    log.info({ certificateId }, "certificate.email пропущен: EMAIL_ENABLED=false");
    return;
  }

  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const msg = certificateEmail({
    to,
    holderName: cert.holderName,
    courseTitle: cert.course.title,
    number: cert.number,
    verifyUrl: `${base}/verify/${cert.verifyHash}`,
    orgName: membership?.org.name ?? null,
    label: membership?.label ?? null,
  });
  const pdf = await storage.get(cert.pdfKey);
  const { sendEmail } = await import("@/lib/email/send.js");
  await sendEmail({
    ...msg,
    attachments: [
      {
        filename: `certificate-${cert.number.replace(/\D+/g, "-")}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  });
  await db.certificate.update({
    where: { id: cert.id },
    data: { emailedAt: new Date(), emailedTo: to },
  });
}
