"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { PlayCircle, FileText, ScrollText, Bot } from "lucide-react";
import { SecurePlayer, type SubtitleTrackInfo } from "@/components/player/secure-player";
import { TutorChat } from "@/components/learn/tutor-chat";

/**
 * Вкладки урока (современный кабинет курса): Видео · Конспект · Транскрипт.
 * Плеер монтируется один раз (вне переключения вкладок), чтобы не прерывать
 * воспроизведение; конспект (markdown) и транскрипт скрываются/показываются.
 */

type Tab = "video" | "summary" | "transcript" | "tutor";

export function LessonTabs({
  lessonId,
  videoReady,
  watermark,
  startPositionSec,
  summary,
  transcript,
  subtitles = [],
  defaultSubtitleLang = null,
}: {
  lessonId: string;
  videoReady: boolean;
  watermark: string;
  startPositionSec: number;
  summary: string | null;
  transcript: string | null;
  subtitles?: SubtitleTrackInfo[];
  defaultSubtitleLang?: string | null;
}) {
  const [tab, setTab] = useState<Tab>("video");

  const tabs: { key: Tab; label: string; icon: typeof PlayCircle; show: boolean }[] = [
    { key: "video", label: "Видео", icon: PlayCircle, show: true },
    { key: "summary", label: "Конспект", icon: FileText, show: !!summary },
    { key: "transcript", label: "Транскрипт", icon: ScrollText, show: !!transcript },
    { key: "tutor", label: "Наставник", icon: Bot, show: true },
  ];

  return (
    <div>
      {/* Переключатель вкладок */}
      <div className="flex gap-1 rounded-xl bg-foreground/[0.04] p-1">
        {tabs.filter((t) => t.show).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
            {tab === t.key ? (
              <motion.span
                layoutId="lesson-tab"
                className="absolute inset-0 rounded-lg bg-background shadow-sm"
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
            ) : null}
            <span className={`relative z-10 flex items-center gap-1.5 ${tab === t.key ? "text-amber-700" : "text-foreground/60"}`}>
              <t.icon className="size-4" />
              {t.label}
            </span>
          </button>
        ))}
      </div>

      {/* Видео — всегда смонтировано, скрывается через display */}
      <div className={`mt-4 ${tab === "video" ? "block" : "hidden"}`}>
        {videoReady ? (
          <SecurePlayer
            lessonId={lessonId}
            watermark={watermark}
            startPositionSec={startPositionSec}
            subtitles={subtitles}
            defaultSubtitleLang={defaultSubtitleLang}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-2xl border border-foreground/10 bg-foreground/[0.03] text-foreground/50">
            Видео готовится — загляните позже.
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {tab === "summary" && summary ? (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="prose-quiz mt-4 rounded-2xl border border-foreground/10 bg-background p-6"
          >
            <Markdown text={summary} />
          </motion.div>
        ) : null}

        {tab === "transcript" && transcript ? (
          <motion.div
            key="transcript"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 max-h-[60vh] overflow-y-auto rounded-2xl border border-foreground/10 bg-background p-6 text-sm leading-relaxed text-foreground/80 [user-select:none]"
          >
            <Markdown text={transcript} />
          </motion.div>
        ) : null}

        {tab === "tutor" ? (
          <motion.div key="tutor" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
            <TutorChat lessonId={lessonId} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Markdown-рендер с типографикой курса. */
function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      components={{
        h2: ({ children }) => <h2 className="text-lg font-bold">{children}</h2>,
        h3: ({ children }) => <h3 className="mt-4 font-semibold">{children}</h3>,
        p: ({ children }) => <p className="mt-2 text-foreground/80">{children}</p>,
        ul: ({ children }) => <ul className="mt-2 list-disc space-y-1.5 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1.5 pl-5">{children}</ol>,
        li: ({ children }) => <li className="text-foreground/80">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
