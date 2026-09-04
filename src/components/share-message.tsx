"use client";

import { useState } from "react";
import { Check, Copy, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Блок «готовое сообщение»: текст доступа целиком и кнопка «копировать».
 *
 * Появляется везде, где система показывает пароль или код один раз. Раньше в
 * каждом таком месте была своя кнопка копирования, и в буфер уходила пара
 * «логин/пароль» без единого слова инструкции — человек на том конце получал
 * набор символов и звонил с вопросами. Здесь копируется текст целиком, готовый
 * к вставке в мессенджер.
 *
 * Отправку намеренно не автоматизируем: доступ передаёт живой человек своими
 * средствами (писем в MVP нет), и по дороге он часто дописывает пару слов от
 * себя — кнопка «отправить» этому только мешала бы.
 */
export function ShareMessage({
  text,
  title,
  hint,
  rows = 6,
  printable = false,
}: {
  text: string;
  title?: string;
  hint?: string;
  rows?: number;
  /** Показать кнопку печати — для кодов, которые раздают на бумаге. */
  printable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function copy() {
    void navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setError(null);
        window.setTimeout(() => setCopied(false), 2500);
      },
      () => setError("Браузер не дал скопировать — выделите текст в поле и скопируйте вручную."),
    );
  }

  return (
    <div className="rounded-xl border border-foreground/10 bg-background p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{title ?? "Готовое сообщение"}</p>
        <p className="text-xs text-foreground/50">
          {hint ?? "Скопируйте и отправьте в WhatsApp, Telegram или письмом"}
        </p>
      </div>

      <textarea
        readOnly
        value={text}
        rows={rows}
        onFocus={(e) => e.currentTarget.select()}
        className="mt-3 w-full resize-y rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3 font-mono text-xs leading-relaxed text-foreground/80"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant={copied ? "outline" : "default"} onClick={copy}>
          {copied ? <Check className="mr-1.5 size-4" /> : <Copy className="mr-1.5 size-4" />}
          {copied ? "Скопировано" : "Копировать сообщение"}
        </Button>
        {printable ? (
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-9 items-center rounded-lg border border-foreground/20 px-3 text-sm font-medium transition-colors hover:bg-foreground/5"
          >
            <Printer className="mr-1.5 size-4 text-foreground/60" />
            Печать
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
