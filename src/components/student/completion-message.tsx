import { Heart } from "lucide-react";

/**
 * Благодарность по окончании курса (Course.completionMessage). Заголовок общий,
 * текст — из курса: у частей большой программы он говорит, что дальше
 * (sales-diy — первая часть ещё не вышедшего основного курса).
 */
export function CompletionMessage({ message, className = "" }: { message: string; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-emerald-600/25 bg-emerald-500/[0.06] p-5 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700">
          <Heart className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold">Спасибо, что прошли курс до конца!</p>
          <p className="mt-1 whitespace-pre-line text-sm text-foreground/75">{message}</p>
        </div>
      </div>
    </div>
  );
}
