"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  PlayCircle,
  FileText,
  ScrollText,
  Bot,
  Presentation,
  Layers,
  MessageSquareWarning,
  Headphones,
  Podcast,
  ListOrdered,
  SearchCheck,
  ListChecks,
  MapPin,
  MessagesSquare,
} from "lucide-react";
import { SecurePlayer, type SubtitleTrackInfo } from "@/components/player/secure-player";
import { TutorChat } from "@/components/learn/tutor-chat";
import { SlideDeck } from "@/components/learn/slide-deck";
import { FlashcardsDeck } from "@/components/learn/flashcards-deck";
import { ObjectionTrainer } from "@/components/learn/objection-trainer";
import { AudioPlayer } from "@/components/learn/podcast-player";
import { ChecklistCard } from "@/components/learn/checklist-card";
import { ScriptBuilder } from "@/components/learn/script-builder";
import { DialogueAudit } from "@/components/learn/dialogue-audit";
import { HotspotImage } from "@/components/learn/hotspot-image";
import { SimulationChat } from "@/components/learn/simulation-chat";
import type { SlideDeckData } from "@/lib/slides";
import type {
  FlashcardsData,
  ObjectionsData,
  ChecklistData,
  ScriptBuilderData,
  DialogueAuditData,
  HotspotData,
} from "@/lib/interactive";

export interface SimulationInfo {
  id: string;
  title: string;
  persona: string;
  objectives: string[];
}

/**
 * Вкладки урока (современный кабинет курса): Видео · Конспект · Транскрипт.
 * Плеер монтируется один раз (вне переключения вкладок), чтобы не прерывать
 * воспроизведение; конспект (markdown) и транскрипт скрываются/показываются.
 */

type Tab =
  | "video"
  | "audio"
  | "podcast"
  | "slides"
  | "summary"
  | "flashcards"
  | "objections"
  | "script"
  | "audit"
  | "checklist"
  | "hotspot"
  | "simulation"
  | "transcript"
  | "tutor";

export function LessonTabs({
  lessonId,
  videoReady,
  hasAudio = false,
  hasPodcast = false,
  watermark,
  startPositionSec,
  summary,
  transcript,
  slides = null,
  flashcards = null,
  objections = null,
  checklist = null,
  script = null,
  audit = null,
  hotspot = null,
  simulation = null,
  subtitles = [],
  defaultSubtitleLang = null,
}: {
  lessonId: string;
  videoReady: boolean;
  hasAudio?: boolean;
  hasPodcast?: boolean;
  watermark: string;
  startPositionSec: number;
  summary: string | null;
  transcript: string | null;
  slides?: SlideDeckData | null;
  flashcards?: FlashcardsData | null;
  objections?: ObjectionsData | null;
  checklist?: ChecklistData | null;
  script?: ScriptBuilderData | null;
  audit?: DialogueAuditData | null;
  hotspot?: HotspotData | null;
  simulation?: SimulationInfo | null;
  subtitles?: SubtitleTrackInfo[];
  defaultSubtitleLang?: string | null;
}) {
  const [tab, setTab] = useState<Tab>("video");

  const tabs: { key: Tab; label: string; icon: typeof PlayCircle; show: boolean }[] = [
    { key: "video", label: "Видео", icon: PlayCircle, show: true },
    { key: "podcast", label: "Подкаст", icon: Podcast, show: hasPodcast },
    { key: "audio", label: "Аудиоверсия", icon: Headphones, show: hasAudio },
    { key: "slides", label: "Презентация", icon: Presentation, show: !!slides },
    { key: "summary", label: "Конспект", icon: FileText, show: !!summary },
    { key: "flashcards", label: "Карточки", icon: Layers, show: !!flashcards },
    { key: "objections", label: "Возражения", icon: MessageSquareWarning, show: !!objections },
    { key: "script", label: "Скрипт", icon: ListOrdered, show: !!script },
    { key: "audit", label: "Найди ошибку", icon: SearchCheck, show: !!audit },
    { key: "checklist", label: "Чек-лист", icon: ListChecks, show: !!checklist },
    { key: "hotspot", label: "Схема", icon: MapPin, show: !!hotspot },
    { key: "simulation", label: "Симулятор", icon: MessagesSquare, show: !!simulation },
    { key: "transcript", label: "Транскрипт", icon: ScrollText, show: !!transcript },
    { key: "tutor", label: "Наставник", icon: Bot, show: true },
  ];

  return (
    <div>
      {/* Переключатель вкладок — на узких экранах прокручивается по горизонтали */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-foreground/[0.04] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.filter((t) => t.show).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="relative flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:flex-1"
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

      {/* Аудио — монтируется один раз (вне переключения вкладок), чтобы не рвать воспроизведение */}
      {hasPodcast ? (
        <div className={`mt-4 ${tab === "podcast" ? "block" : "hidden"}`}>
          <AudioPlayer lessonId={lessonId} variant="podcast" />
        </div>
      ) : null}
      {hasAudio ? (
        <div className={`mt-4 ${tab === "audio" ? "block" : "hidden"}`}>
          <AudioPlayer lessonId={lessonId} variant="audio" />
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {tab === "slides" && slides ? (
          <motion.div
            key="slides"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4"
          >
            <SlideDeck deck={slides} />
          </motion.div>
        ) : null}

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

        {tab === "flashcards" && flashcards ? (
          <motion.div
            key="flashcards"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4"
          >
            <FlashcardsDeck deck={flashcards} />
          </motion.div>
        ) : null}

        {tab === "objections" && objections ? (
          <motion.div
            key="objections"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4"
          >
            <ObjectionTrainer data={objections} />
          </motion.div>
        ) : null}

        {tab === "script" && script ? (
          <motion.div key="script" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
            <ScriptBuilder data={script} />
          </motion.div>
        ) : null}

        {tab === "audit" && audit ? (
          <motion.div key="audit" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
            <DialogueAudit data={audit} />
          </motion.div>
        ) : null}

        {tab === "checklist" && checklist ? (
          <motion.div key="checklist" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
            <ChecklistCard data={checklist} />
          </motion.div>
        ) : null}

        {tab === "hotspot" && hotspot ? (
          <motion.div key="hotspot" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
            <HotspotImage data={hotspot} />
          </motion.div>
        ) : null}

        {tab === "simulation" && simulation ? (
          <motion.div key="simulation" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
            <SimulationChat scenario={simulation} />
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
