"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { setMemberLabelAction } from "../../actions";

/**
 * Подпись работника под его логином: кличка, должность, «Кассир-2» — что
 * ответственному удобно, чтобы не путать, кому какой логин достался. Хранится
 * открытым текстом; ФИО сюда не вписывают (оферта /offer-b2b, п. 10.1).
 *
 * Владелец платформы подпись видит, но не правит — её ведёт клиент.
 */
export function MemberLabel({
  orgId,
  membershipId,
  label,
  readOnly = false,
}: {
  orgId: string;
  membershipId: string;
  label: string | null;
  readOnly?: boolean;
}) {
  const [text, setText] = useState(label);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (readOnly) {
    return text ? <span className="mt-0.5 block text-xs text-foreground/70">{text}</span> : null;
  }

  if (editing) {
    return (
      <span className="mt-1 flex items-center gap-1.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={60}
          placeholder="Например, Кассир-2"
          className="h-8 w-52 rounded-md border border-foreground/15 bg-background px-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
            if (e.key === "Enter") void save();
          }}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => void save()}
          aria-label="Сохранить подпись"
          className="rounded p-1 text-emerald-700 hover:bg-emerald-500/10"
        >
          <Check className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          aria-label="Отменить"
          className="rounded p-1 text-foreground/40 hover:bg-foreground/5"
        >
          <X className="size-4" />
        </button>
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
      </span>
    );
  }

  if (text) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(text);
          setEditing(true);
        }}
        title="Изменить подпись"
        className="mt-0.5 flex items-center gap-1.5 text-xs text-foreground/70 hover:text-foreground"
      >
        <span className="font-sans">{text}</span>
        <Pencil className="size-3 text-foreground/35" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft("");
        setEditing(true);
      }}
      className="mt-1 flex items-center gap-1.5 rounded-md border border-dashed border-foreground/20 px-2 py-0.5 text-xs text-foreground/55 transition-colors hover:bg-foreground/5 hover:text-foreground"
    >
      <Pencil className="size-3" />
      Подписать
    </button>
  );

  async function save() {
    setPending(true);
    setError(null);
    const res = await setMemberLabelAction({ orgId, membershipId, label: draft });
    setPending(false);
    if (res.ok) {
      setText(draft.trim() || null);
      setEditing(false);
    } else {
      setError(res.error);
    }
  }
}
