"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Clock, StickyNote } from "lucide-react";
import { addNoteAction, deleteNoteAction } from "@/app/(student)/app/learn/[courseSlug]/[lessonId]/actions";
import { usePlayerHandleRef } from "@/components/player/player-context";
import { formatTimecode } from "@/lib/learn/format";
import type { NoteView } from "@/lib/learn/notes";

/**
 * Панель заметок урока: добавление заметки на текущей секунде видео, список с
 * перемоткой по клику и удалением. Таймкод берётся из плеера через player-context
 * в момент нажатия (если плеера нет — 0). Оптимистичные обновления.
 */
export function NotesPanel({
  lessonId,
  initialNotes,
  hasVideo,
  onJump,
}: {
  lessonId: string;
  initialNotes: NoteView[];
  hasVideo: boolean;
  onJump?: (sec: number) => void;
}) {
  const [notes, setNotes] = useState<NoteView[]>(initialNotes);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const handleRef = usePlayerHandleRef();

  function currentTime(): number {
    return handleRef?.current?.getCurrentTime() ?? 0;
  }

  function add() {
    const value = text.trim();
    if (!value) return;
    setError(null);
    const at = currentTime();
    startTransition(async () => {
      const res = await addNoteAction({ lessonId, timecodeSec: at, text: value });
      if (res.ok) {
        setNotes((prev) =>
          [...prev, res.data].sort((a, b) => a.timecodeSec - b.timecodeSec),
        );
        setText("");
      } else {
        setError(res.error);
      }
    });
  }

  function remove(id: string) {
    const prev = notes;
    setNotes((n) => n.filter((x) => x.id !== id)); // оптимистично
    startTransition(async () => {
      const res = await deleteNoteAction({ noteId: id });
      if (!res.ok) setNotes(prev); // откат
    });
  }

  function jump(sec: number) {
    if (onJump) onJump(sec);
    handleRef?.current?.seek(sec);
  }

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-5">
      <div className="flex items-center gap-2">
        <StickyNote className="size-5 text-amber-600" />
        <h3 className="font-semibold">Мои заметки</h3>
        {notes.length > 0 ? (
          <span className="rounded-full bg-foreground/10 px-2 text-xs font-semibold text-foreground/60">
            {notes.length}
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") add();
          }}
          rows={3}
          maxLength={2000}
          placeholder={
            hasVideo
              ? "Запишите мысль или формулировку — она привяжется к текущей секунде видео"
              : "Запишите мысль по уроку"
          }
          className="w-full resize-y rounded-xl border border-foreground/20 bg-background p-3 text-sm outline-none focus:border-amber-500/50"
        />
        {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-foreground/50">
            {hasVideo ? "Сохранится на текущей секунде · ⌘/Ctrl+Enter" : "⌘/Ctrl+Enter"}
          </span>
          <button
            type="button"
            onClick={add}
            disabled={pending || !text.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
          >
            <Plus className="size-4" />
            Добавить
          </button>
        </div>
      </div>

      {notes.length > 0 ? (
        <ul className="mt-5 space-y-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className="group flex items-start gap-3 rounded-xl border border-foreground/10 p-3"
            >
              <button
                type="button"
                onClick={() => jump(n.timecodeSec)}
                disabled={!hasVideo}
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 font-mono text-xs font-semibold text-amber-700 transition-colors enabled:hover:bg-amber-500/20 disabled:opacity-60"
                title={hasVideo ? "Перейти к этому моменту" : undefined}
              >
                <Clock className="size-3" />
                {formatTimecode(n.timecodeSec)}
              </button>
              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm text-foreground/80">
                {n.text}
              </p>
              <button
                type="button"
                onClick={() => remove(n.id)}
                aria-label="Удалить заметку"
                className="shrink-0 text-foreground/30 transition-colors hover:text-red-600"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-sm text-foreground/50">
          Пока нет заметок. Записывайте удачные формулировки и скрипты прямо во время урока.
        </p>
      )}
    </div>
  );
}
