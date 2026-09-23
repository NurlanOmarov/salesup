"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Pencil, X } from "lucide-react";
import { IncomeForm, type EditableIncome, type IncomeFormLists } from "./income-form";

/**
 * Правка записанного поступления: забыли заметку, ошиблись в сумме или дате.
 *
 * Справочники (организации, курсы, получатели, ставки) одинаковы для всех строк
 * журнала, поэтому лежат в провайдере и уезжают в браузер один раз, а не копией
 * на каждую строку. В строке — только кнопка с данными самой записи.
 */

const EditContext = createContext<((income: EditableIncome) => void) | null>(null);

export function IncomeEditProvider({
  lists,
  children,
}: {
  lists: IncomeFormLists;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState<EditableIncome | null>(null);
  return (
    <EditContext.Provider value={setEditing}>
      {children}
      {editing ? (
        <IncomeEditDialog
          lists={lists}
          income={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </EditContext.Provider>
  );
}

export function EditIncomeButton({
  income,
  label,
}: {
  income: EditableIncome;
  label: string;
}) {
  const open = useContext(EditContext);
  if (!open) return null;
  return (
    <button
      type="button"
      onClick={() => open(income)}
      aria-label={`Изменить поступление ${label}`}
      title="Изменить"
      className="rounded p-1 text-foreground/35 transition-colors hover:bg-amber-500/10 hover:text-amber-700"
    >
      <Pencil className="size-4" />
    </button>
  );
}

function IncomeEditDialog({
  lists,
  income,
  onClose,
}: {
  lists: IncomeFormLists;
  income: EditableIncome;
  onClose: () => void;
}) {
  // Esc закрывает, фон не прокручивается под окном.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  // Портал: строка таблицы — неподходящий контекст для модального окна.
  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Изменить поступление"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-foreground/10 bg-background shadow-xl sm:max-h-[88vh] sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-foreground/10 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-foreground/50">Поступление</p>
            <h2 className="mt-0.5 text-lg font-semibold">Изменить запись</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-lg p-1.5 text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">
          <IncomeForm {...lists} income={income} onSaved={onClose} />
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
