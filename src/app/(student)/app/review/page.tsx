import type { Metadata } from "next";
import { Repeat } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getDueCards, seedReviewsForUser } from "@/lib/learn/review";
import { ReviewDeck } from "@/components/learn/review-deck";

export const metadata: Metadata = {
  title: "Повторение",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const session = await requireUser();
  const userId = session.user.id;

  // Засеять недостающие карточки доступных курсов и собрать карточки к повторению.
  await seedReviewsForUser(userId);
  const due = await getDueCards(userId);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center gap-2">
        <Repeat className="size-6 text-amber-600" />
        <h1 className="text-2xl font-bold">Повторение</h1>
      </div>
      <p className="mt-1 text-sm text-foreground/60">
        Карточки терминов и препаратов возвращаются по интервалам — так знания закрепляются надолго.
      </p>

      <div className="mt-5">
        <ReviewDeck initial={due} />
      </div>
    </div>
  );
}
