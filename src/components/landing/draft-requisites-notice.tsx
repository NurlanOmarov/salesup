import { REQUISITES_FILLED } from "@/content/legal";

/**
 * Предупреждение на /offer и /privacy, пока реквизиты ИП не заполнены
 * (src/content/legal/requisites.ts). Документ с плейсхолдерами вместо УНП и
 * адреса не выполняет требование ст. 7 Закона РБ «О защите прав потребителей»,
 * поэтому владелец должен видеть это на самой странице. Заполнил реквизиты →
 * REQUISITES_FILLED = true → блок исчезает и страницы становятся индексируемыми.
 */
export function DraftRequisitesNotice() {
  if (REQUISITES_FILLED) return null;

  return (
    <div
      role="status"
      className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground/80"
    >
      <p className="font-semibold">Черновик документа</p>
      <p className="mt-1">
        Реквизиты Исполнителя ещё не заполнены — вместо них в тексте показаны поля
        в квадратных скобках. Документ не применяется до момента заполнения.
      </p>
    </div>
  );
}
