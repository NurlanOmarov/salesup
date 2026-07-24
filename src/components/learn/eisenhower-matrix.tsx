"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Undo2 } from "lucide-react";
import type { EisenhowerData } from "@/lib/interactive";

/**
 * Интерактивная матрица Эйзенхауэра. Ученик вводит СВОИ задачи и раскладывает их
 * по 4 квадрантам (важно × срочно) — у каждого своё действие. Оболочка без
 * AI-контента и без сохранения (прогресс локальный, ПДн не собираем).
 * Портрет Д. Эйзенхауэра — общественное достояние (офиц. госфото США, 1959).
 */

type QuadrantKey = 0 | 1 | 2 | 3;

interface Task {
  id: number;
  text: string;
  q: QuadrantKey | null;
}

const QUADRANTS: {
  key: QuadrantKey;
  action: string;
  hint: string;
  cls: string; // рамка/фон карточки
  chip: string; // фон фишки в квадранте
  btn: string; // кнопка «положить сюда»
}[] = [
  {
    key: 0,
    action: "Сделать сейчас",
    hint: "Важно и срочно — кризисы, дедлайны",
    cls: "border-red-500/30 bg-red-500/[0.04]",
    chip: "bg-red-500/12 text-red-700",
    btn: "bg-red-500/15 text-red-700 hover:bg-red-500/25",
  },
  {
    key: 1,
    action: "Запланировать",
    hint: "Важно, не срочно — цели, развитие",
    cls: "border-emerald-500/30 bg-emerald-500/[0.04]",
    chip: "bg-emerald-500/12 text-emerald-700",
    btn: "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25",
  },
  {
    key: 2,
    action: "Делегировать",
    hint: "Срочно, не важно — часть звонков, встреч",
    cls: "border-amber-500/30 bg-amber-500/[0.04]",
    chip: "bg-amber-500/15 text-amber-800",
    btn: "bg-amber-500/20 text-amber-800 hover:bg-amber-500/30",
  },
  {
    key: 3,
    action: "Удалить",
    hint: "Не важно и не срочно — пожиратели времени",
    cls: "border-foreground/15 bg-foreground/[0.03]",
    chip: "bg-foreground/10 text-foreground/70",
    btn: "bg-foreground/10 text-foreground/60 hover:bg-foreground/20",
  },
];

export function EisenhowerMatrix({ data }: { data: EisenhowerData }) {
  const nextId = useRef(0);
  const [tasks, setTasks] = useState<Task[]>(() =>
    (data.seedTasks ?? []).map((text) => ({ id: nextId.current++, text, q: null })),
  );
  const [draft, setDraft] = useState("");

  const unsorted = tasks.filter((t) => t.q === null);

  function addTask() {
    const v = draft.trim();
    if (!v) return;
    setTasks((p) => [...p, { id: nextId.current++, text: v, q: null }]);
    setDraft("");
  }

  const place = (id: number, q: QuadrantKey | null) =>
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, q } : t)));

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <Image
          src="/images/eisenhower.jpg"
          alt="Дуайт Эйзенхауэр"
          width={56}
          height={70}
          className="hidden shrink-0 rounded-lg object-cover shadow-sm sm:block"
        />
        <div>
          <h3 className="font-bold">{data.title}</h3>
          <p className="mt-1 text-sm text-foreground/65">{data.prompt}</p>
          <p className="mt-1 text-[11px] text-foreground/40">
            Матрица названа в честь Дуайта Эйзенхауэра, 34-го президента США: «Важное редко бывает срочным, а срочное — важным».
          </p>
        </div>
      </div>

      {/* Ввод задачи */}
      <div className="mt-5 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTask();
            }
          }}
          placeholder="Добавьте задачу из своего дня…"
          className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button
          type="button"
          onClick={addTask}
          disabled={!draft.trim()}
          aria-label="Добавить задачу"
          className="flex shrink-0 items-center justify-center rounded-lg bg-brand px-3 text-white transition-opacity disabled:opacity-40"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {/* Неразобранные задачи + быстрые кнопки-квадранты */}
      <AnimatePresence>
        {unsorted.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 rounded-xl border border-dashed border-foreground/20 p-3"
          >
            <p className="mb-2 text-xs font-medium text-foreground/55">
              Перетащите в квадрант или нажмите кнопку ({unsorted.length}):
            </p>
            <ul className="space-y-2">
              {unsorted.map((t) => (
                <li
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", String(t.id))}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-foreground/[0.04] px-3 py-2 [cursor:grab] active:[cursor:grabbing]"
                >
                  <span className="mr-1 flex-1 text-sm text-foreground/85">{t.text}</span>
                  {QUADRANTS.map((q) => (
                    <button
                      key={q.key}
                      type="button"
                      onClick={() => place(t.id, q.key)}
                      className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${q.btn}`}
                    >
                      {q.action}
                    </button>
                  ))}
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Матрица 2×2 */}
      <div className="mt-4">
        {/* Заголовки колонок */}
        <div className="mb-1 grid grid-cols-[auto_1fr_1fr] gap-2 text-center text-[11px] font-semibold uppercase tracking-wide text-foreground/40">
          <span />
          <span>Срочно</span>
          <span>Не срочно</span>
        </div>
        <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
          <RowLabel>Важно</RowLabel>
          <Quadrant q={QUADRANTS[0]!} tasks={tasks} onReturn={(id) => place(id, null)} onDropTask={(id) => place(id, 0)} />
          <Quadrant q={QUADRANTS[1]!} tasks={tasks} onReturn={(id) => place(id, null)} onDropTask={(id) => place(id, 1)} />
          <RowLabel>Не важно</RowLabel>
          <Quadrant q={QUADRANTS[2]!} tasks={tasks} onReturn={(id) => place(id, null)} onDropTask={(id) => place(id, 2)} />
          <Quadrant q={QUADRANTS[3]!} tasks={tasks} onReturn={(id) => place(id, null)} onDropTask={(id) => place(id, 3)} />
        </div>
      </div>

      {tasks.length > 0 && unsorted.length === 0 ? (
        <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700">
          Все задачи разложены. Начните с «Сделать сейчас», львиную долю времени отдайте квадранту «Запланировать» — там растут результаты.
        </p>
      ) : null}
    </div>
  );
}

function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-6 items-center justify-center">
      <span className="rotate-180 text-[11px] font-semibold uppercase tracking-wide text-foreground/40 [writing-mode:vertical-rl]">
        {children}
      </span>
    </div>
  );
}

function Quadrant({
  q,
  tasks,
  onReturn,
  onDropTask,
}: {
  q: (typeof QUADRANTS)[number];
  tasks: Task[];
  onReturn: (id: number) => void;
  onDropTask: (id: number) => void;
}) {
  const items = tasks.filter((t) => t.q === q.key);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = Number(e.dataTransfer.getData("text/plain"));
        if (!Number.isNaN(id)) onDropTask(id);
      }}
      className={`min-h-28 rounded-xl border p-3 transition-colors ${q.cls} ${
        over ? "ring-2 ring-brand/60 ring-offset-1" : ""
      }`}
    >
      <p className="text-sm font-semibold text-foreground/80">{q.action}</p>
      <p className="mt-0.5 text-[11px] text-foreground/45">{q.hint}</p>
      <ul className="mt-2 space-y-1.5">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.li
              key={t.id}
              layout
              draggable
              onDragStartCapture={(e: React.DragEvent) => e.dataTransfer.setData("text/plain", String(t.id))}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`group flex items-center gap-1.5 rounded-md px-2 py-1 text-xs [cursor:grab] active:[cursor:grabbing] ${q.chip}`}
            >
              <span className="flex-1">{t.text}</span>
              <button
                type="button"
                onClick={() => onReturn(t.id)}
                aria-label="Вернуть в список"
                className="opacity-40 transition-opacity hover:opacity-90"
              >
                <Undo2 className="size-3" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
