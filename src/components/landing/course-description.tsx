import { CheckCircle2 } from "lucide-react";
import { parseDescription } from "@/lib/courses/description";

/**
 * Описание курса на витрине: абзацы, подводки и списки вместо одной простыни
 * текста (разметку понимает lib/courses/description).
 */
export function CourseDescription({ text }: { text: string | null | undefined }) {
  const blocks = parseDescription(text);
  if (blocks.length === 0) return null;

  return (
    <div className="mt-4 space-y-4">
      {blocks.map((block, i) => {
        if (block.kind === "ul") {
          return (
            <ul key={i} className="space-y-2.5">
              {block.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-strong" />
                  <span className="leading-relaxed text-foreground/70">{item}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (block.kind === "lead") {
          return (
            <p key={i} className="font-semibold text-foreground">
              {block.text}
            </p>
          );
        }
        return (
          <p key={i} className="leading-relaxed text-foreground/70">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
