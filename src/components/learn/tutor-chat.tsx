"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Bot, Send, User } from "lucide-react";

/**
 * Чат AI-наставника по уроку (S7.2). Отвечает строго из материалов курса (RAG).
 * Чипы быстрых вопросов, источники под ответом, остаток дневного лимита.
 */

interface Msg {
  role: "user" | "assistant";
  text: string;
  sources?: { lessonTitle: string }[];
}

const QUICK = [
  "Объясни главную мысль урока",
  "Приведи пример из практики",
  "Как применить это на реальной консультации?",
];

export function TutorChat({ lessonId }: { lessonId: string }) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: "Здравствуйте! Я AI-наставник. Спросите что угодно по материалам этого урока." },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMsgRef = useRef<HTMLDivElement>(null);

  // Прокручиваем ТОЛЬКО внутренний контейнер (не страницу). Скроллим к НАЧАЛУ
  // последнего сообщения, а не к самому низу — чтобы длинный ответ читался с верха.
  useEffect(() => {
    const container = scrollRef.current;
    const last = lastMsgRef.current;
    if (!container) return;
    if (last) container.scrollTop = Math.max(0, last.offsetTop - 12);
    else container.scrollTop = container.scrollHeight;
  }, [messages, pending]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setPending(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, message: q }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", text: data.answer, sources: data.sources }]);
      if (typeof data.remaining === "number") setRemaining(data.remaining);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Не удалось получить ответ. Попробуйте ещё раз." }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-[60vh] flex-col rounded-2xl border border-foreground/10 bg-background">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            ref={!pending && i === messages.length - 1 ? lastMsgRef : undefined}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${m.role === "user" ? "bg-amber-500/15 text-amber-700" : "bg-slate-200 text-slate-600"}`}>
              {m.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === "user" ? "rounded-tr-sm bg-amber-500/[0.08]" : "rounded-tl-sm bg-foreground/[0.04]"}`}>
              <p className="whitespace-pre-wrap text-foreground/85">{m.text}</p>
              {m.sources && m.sources.length > 0 ? (
                <p className="mt-1.5 text-xs text-foreground/40">
                  Источник: {m.sources.map((s) => s.lessonTitle).join(", ")}
                </p>
              ) : null}
            </div>
          </motion.div>
        ))}
        {pending ? (
          <div ref={lastMsgRef} className="flex gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-full bg-slate-200 text-slate-600">
              <Bot className="size-4" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-foreground/[0.04] px-3.5 py-2.5 text-sm">
              {/* Бегущий блик по буквам: ожидание читается как работа, а не как зависание */}
              <span className="shimmer-text font-medium">
                Ищу ответ в материалах курса…
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Чипы быстрых вопросов */}
      {messages.length <= 1 ? (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              className="rounded-full border border-foreground/15 px-3 py-1.5 text-xs text-foreground/70 transition-colors hover:border-amber-500/40 hover:bg-amber-500/5"
            >
              {q}
            </button>
          ))}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex items-center gap-2 border-t border-foreground/10 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Спросите по материалам урока…"
          className="flex-1 rounded-xl border border-foreground/15 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          disabled={pending || input.trim().length < 2}
          className="flex size-10 items-center justify-center rounded-xl bg-amber-500 text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
        >
          <Send className="size-4" />
        </button>
      </form>
      {remaining !== null ? (
        <p className="px-4 pb-2 text-center text-xs text-foreground/40">Осталось вопросов сегодня: {remaining}</p>
      ) : null}
    </div>
  );
}
