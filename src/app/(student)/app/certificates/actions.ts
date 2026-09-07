"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { safeAction } from "@/lib/safe-action";
import { moderateReview } from "@/lib/reviews/moderation";
import { isEnrollmentActive } from "@/lib/access";

/** Подпись отзыва работника организации: ПДн у B2B-учеников мы не получаем. */
const ORG_LEARNER_NAME = "Ученик корпоративной программы";

/**
 * Отзыв о курсе перед запросом сертификата.
 *
 * Имя — обязательное поле розницы: отзыв без подписи не работает как
 * доказательство. Для работников организаций поле не принимается вовсе
 * (CLAUDE.md, правило 9: платформа не получает их ПДн) — подпись обезличена.
 *
 * publicConsent — явное согласие на публикацию под этим именем (Закон РБ
 * № 99-З). Снято — отзыв виден только владельцу в /admin/reviews.
 */
const schema = z.object({
  courseId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  text: z
    .string()
    .trim()
    .min(40, "Напишите хотя бы пару предложений — коротким отзывом не поделишься")
    .max(2000),
  userName: z.string().trim().min(2, "Укажите имя").max(80).optional(),
  publicConsent: z.boolean().default(true),
});

export const submitCourseReviewAction = safeAction(
  { schema, auth: "user" },
  async (input, { session }) => {
    const userId = session!.user.id;

    // Отзыв о курсе может оставить только тот, у кого есть (или был) доступ.
    const [enrollment, membership, course] = await Promise.all([
      db.enrollment.findFirst({
        where: { userId, courseId: input.courseId },
        select: { startsAt: true, expiresAt: true, revokedAt: true },
      }),
      db.orgMembership.findFirst({ where: { userId }, select: { id: true } }),
      db.course.findUnique({
        where: { id: input.courseId },
        select: { slug: true },
      }),
    ]);
    if (!enrollment || !course) throw new Error("Курс недоступен");
    if (!isEnrollmentActive(enrollment, new Date())) throw new Error("Доступ к курсу истёк");

    const isOrgLearner = membership !== null;
    if (!isOrgLearner && !input.userName) throw new Error("Укажите имя");
    const userName = isOrgLearner ? ORG_LEARNER_NAME : input.userName!;

    const { status, note } = moderateReview(input.text);
    const data = {
      rating: input.rating,
      text: input.text,
      userName,
      autoModeration: status,
      moderationNote: note,
      publicConsent: input.publicConsent,
    };
    await db.review.upsert({
      where: { courseId_userId: { courseId: input.courseId, userId } },
      create: { courseId: input.courseId, userId, ...data },
      update: data,
    });

    // Витрина курса статична (ISR) — сбрасываем её, чтобы отзыв появился сразу.
    revalidatePath(`/courses/${course.slug}`);
    revalidatePath("/app/certificates");
    return { published: status === "VALIDATED" && input.publicConsent };
  },
);
