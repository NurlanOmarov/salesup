"use client";

import { useEffect, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { decryptLabel, encryptLabel } from "@/lib/org/crypto";
import { useOrgKey } from "../org-key-provider";
import { setMemberLabelAction } from "../../actions";

/**
 * Имя сотрудника: расшифровывается в браузере и там же шифруется при
 * сохранении. На сервер уходит только blob — платформа не видит, кто стоит за
 * кодом (docs/B2B-PLAN.md §5.2, оферта /offer-b2b п. 10.1–10.2).
 *
 * Когда ПИН-код не введён, компонент молчит: в таблице остаётся код сотрудника.
 */
export function MemberLabel({
  orgId,
  membershipId,
  labelEnc,
}: {
  orgId: string;
  membershipId: string;
  labelEnc: string | null;
}) {
  const { status, orgKey } = useOrgKey();
  const [text, setText] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Пустое имя мигает несколько секунд после разблокировки — ровно чтобы
  // заметить новый элемент строки. Постоянная пульсация раздражала бы.
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    if (status !== "unlocked") return;
    setHighlight(true);
    const t = window.setTimeout(() => setHighlight(false), 6000);
    return () => window.clearTimeout(t);
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    if (!orgKey) {
      setText(null);
      return;
    }
    void decryptLabel(orgKey, labelEnc).then((value) => {
      if (!cancelled) setText(value);
    });
    return () => {
      cancelled = true;
    };
  }, [orgKey, labelEnc]);

  if (status !== "unlocked") return null;

  if (editing) {
    return (
      <span className="mt-1 flex items-center gap-1.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={120}
          placeholder="Например, Александр"
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
          aria-label="Сохранить имя"
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

  // Названного сотрудника показываем спокойно, а пустое место — заметной
  // пунктирной кнопкой: введя код, ответственный не догадывался, что в строке
  // появилось редактируемое поле, и уходил со страницы ни с чем.
  if (text) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(text);
          setEditing(true);
        }}
        title="Изменить имя"
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
      className={`mt-1 flex items-center gap-1.5 rounded-md border border-dashed border-amber-500/50 bg-amber-500/[0.07] px-2 py-0.5 text-xs text-amber-700 transition-colors hover:bg-amber-500/15 hover:text-amber-800 ${
        highlight ? "animate-pulse motion-reduce:animate-none" : ""
      }`}
    >
      <Pencil className="size-3" />
      Добавить имя
    </button>
  );

  async function save() {
    if (!orgKey) return;
    setPending(true);
    setError(null);
    const blob = await encryptLabel(orgKey, draft);
    const res = await setMemberLabelAction({ orgId, membershipId, labelEnc: blob });
    setPending(false);
    if (res.ok) {
      setText(draft.trim() || null);
      setEditing(false);
    } else {
      setError(res.error);
    }
  }
}
