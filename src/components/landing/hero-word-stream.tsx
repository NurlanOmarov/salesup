"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Правая (чистая) половина hero: полупрозрачные термины продаж, которые
 * «печатаются» как в терминале, замирают и уплывают вверх, растворяясь.
 * Появляются периодически, с паузами — фоновый «эмбиент», не отвлекающий
 * от заголовка слева. Уважает prefers-reduced-motion (тогда не рендерится).
 */

const WORDS = [
  "выявление потребностей",
  "работа с возражениями",
  "закрытие сделки",
  "воронка продаж",
  "холодный звонок",
  "тёплый лид",
  "средний чек",
  "квалификация клиента",
  "презентация ценности",
  "боль клиента",
  "дожим до оплаты",
  "конверсия в оплату",
  "скрипт продаж",
  "апселл и кросс-селл",
  "закрытие на встречу",
  "точки роста",
  "касание клиента",
  "работа с базой",
];

type ActiveWord = {
  id: number;
  text: string;
  top: number; // %
  left: number; // %
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function HeroWordStream() {
  const [words, setWords] = useState<ActiveWord[]>([]);
  const [enabled, setEnabled] = useState(false);
  const idRef = useRef(0);
  const recentRef = useRef<string[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setEnabled(true);
  }, []);

  const spawn = useCallback(() => {
    // не повторяем два последних слова подряд — поток кажется живее
    let text = pick(WORDS);
    let guard = 0;
    while (recentRef.current.includes(text) && guard++ < 8) text = pick(WORDS);
    recentRef.current = [text, ...recentRef.current].slice(0, 2);

    const id = idRef.current++;
    setWords((prev) => [
      ...prev,
      { id, text, top: rand(14, 68), left: rand(4, 46) },
    ]);
  }, []);

  // первое слово — с небольшой задержкой после монтирования
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(spawn, 900);
    return () => clearTimeout(timer);
  }, [enabled, spawn]);

  // как только текущая фраза начинает уходить вверх — печатаем следующую,
  // чтобы поток шёл внахлёст, без пустых пауз
  const handleLeaveStart = useCallback(() => {
    spawn();
  }, [spawn]);

  const remove = useCallback((id: number) => {
    setWords((prev) => prev.filter((w) => w.id !== id));
  }, []);

  if (!enabled) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[1] hidden overflow-hidden lg:block"
    >
      {/* якорим слова к правой половине кадра */}
      <div className="absolute inset-y-0 right-0 w-1/2">
        {words.map((w) => (
          <Word
            key={w.id}
            word={w}
            onLeaveStart={handleLeaveStart}
            onDone={() => remove(w.id)}
          />
        ))}
      </div>
    </div>
  );
}

function Word({
  word,
  onLeaveStart,
  onDone,
}: {
  word: ActiveWord;
  onLeaveStart: () => void;
  onDone: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let i = 0;
    // скорость «печати» символа: 45–80 мс
    const step = () => {
      i += 1;
      setTyped(word.text.slice(0, i));
      if (i < word.text.length) {
        typing = setTimeout(step, rand(45, 80));
      } else {
        // подержим готовое слово, затем отпускаем вверх — и в этот момент
        // сигналим наверх, чтобы начала печататься следующая фраза
        hold = setTimeout(() => {
          setLeaving(true);
          onLeaveStart();
        }, 1100);
      }
    };
    let typing: ReturnType<typeof setTimeout> = setTimeout(step, 40);
    let hold: ReturnType<typeof setTimeout>;
    return () => {
      clearTimeout(typing);
      clearTimeout(hold);
    };
    // onLeaveStart стабилен (useCallback); слово живёт по своему тексту
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.text]);

  const done = typed.length === word.text.length;

  return (
    <span
      className={
        "absolute select-none whitespace-nowrap font-mono text-sm tracking-tight text-white/45 sm:text-base " +
        (leaving ? "hero-word-leave" : "hero-word-enter")
      }
      style={{ top: `${word.top}%`, left: `${word.left}%` }}
      onAnimationEnd={leaving ? onDone : undefined}
    >
      {typed}
      {/* мигающий каре только пока слово печатается */}
      {!done && !leaving ? (
        <span className="hero-word-caret ml-0.5 inline-block">▍</span>
      ) : null}
    </span>
  );
}
