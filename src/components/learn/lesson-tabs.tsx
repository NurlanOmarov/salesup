"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
  BookOpen,
  Dumbbell,
  Zap,
  GitBranch,
  StickyNote,
  Download,
  PawPrint,
  Grid2x2,
  PieChart,
  Target,
  Hourglass,
  Users,
  Milestone,
  Scale,
  ShoppingCart,
  Calculator,
  GraduationCap,
  ChevronRight,
  CheckCircle2,
  Circle,
  ChevronDown,
  X,
} from "lucide-react";
import { SecurePlayer, type SubtitleTrackInfo } from "@/components/player/secure-player";
import { PlayerProvider } from "@/components/player/player-context";
import { NotesPanel } from "@/components/learn/notes-panel";
import type { NoteView } from "@/lib/learn/notes";
import { TutorChat } from "@/components/learn/tutor-chat";
import { SlideDeck } from "@/components/learn/slide-deck";
import { PdfSlideViewer } from "@/components/learn/pdf-slide-viewer";
import { FlashcardsDeck } from "@/components/learn/flashcards-deck";
import { ObjectionTrainer } from "@/components/learn/objection-trainer";
import { RapidFireDrill } from "@/components/learn/rapid-fire-drill";
import { BranchingScenario } from "@/components/learn/branching-scenario";
import { AudioPlayer } from "@/components/learn/podcast-player";
import { ChecklistCard } from "@/components/learn/checklist-card";
import { ScriptBuilder } from "@/components/learn/script-builder";
import { DialogueAudit } from "@/components/learn/dialogue-audit";
import { HotspotImage } from "@/components/learn/hotspot-image";
import { SimulationChat } from "@/components/learn/simulation-chat";
import { MetaphorTrainer } from "@/components/learn/metaphor-trainer";
import { EisenhowerMatrix } from "@/components/learn/eisenhower-matrix";
import { Rule6040 } from "@/components/learn/rule-6040";
import { SmartGoal } from "@/components/learn/smart-goal";
import { TimeAudit } from "@/components/learn/time-audit";
import { ClientTypesTrainer } from "@/components/learn/client-types";
import { StageLadder } from "@/components/learn/stage-ladder";
import { ObjectionScale } from "@/components/learn/objection-scale";
import { NeedsCart } from "@/components/learn/needs-cart";
import { EconomyCalc } from "@/components/learn/economy-calc";
import { PracticeProvider } from "@/components/learn/practice-context";
import { reportPracticeAction } from "@/app/(student)/app/learn/[courseSlug]/[lessonId]/actions";
import { PRACTICE_LABELS, pickMainTrainer, type PracticeKind } from "@/lib/learn/practice";
import type { SlideDeckData } from "@/lib/slides";
import type {
  FlashcardsData,
  ObjectionsData,
  ChecklistData,
  ScriptBuilderData,
  DialogueAuditData,
  HotspotData,
  BranchingData,
  MetaphorData,
  EisenhowerData,
  Rule6040Data,
  SmartGoalData,
  TimeAuditData,
  ClientTypesData,
  StageLadderData,
  ObjectionScaleData,
  NeedsCartData,
  EconomyCalcData,
} from "@/lib/interactive";

export interface SimulationInfo {
  id: string;
  title: string;
  persona: string;
  objectives: string[];
}

/**
 * Вкладки урока (современный кабинет курса). Из-за множества форматов (до 14)
 * переключатель двухуровневый: сверху — группы (Смотреть · Материалы · Практика ·
 * Наставник), под ними — вкладки внутри активной группы (если их больше одной).
 * Это убирает длинную горизонтальную «простыню» и повышает находимость практики.
 * Плеер монтируется один раз (вне переключения вкладок), чтобы не прерывать
 * воспроизведение; markdown-панели скрываются/показываются.
 */

type Tab =
  | "video"
  | "audio"
  | "podcast"
  | "slides"
  | "summary"
  | "flashcards"
  | "objections"
  | "rapidfire"
  | "branching"
  | "script"
  | "audit"
  | "checklist"
  | "hotspot"
  | "metaphor"
  | "eisenhower"
  | "rule6040"
  | "smart"
  | "timeaudit"
  | "clienttypes"
  | "ladder"
  | "scale"
  | "cart"
  | "economy"
  | "simulation"
  | "quiz"
  | "transcript"
  | "notes"
  | "tutor";

type Group = "watch" | "materials" | "practice" | "tutor";

/** Вкладка → вид тренажёра (для учёта прохождения и выбора главного тренажёра). */
const TAB_KIND: Partial<Record<Tab, PracticeKind>> = {
  flashcards: "FLASHCARDS",
  objections: "OBJECTIONS",
  rapidfire: "RAPID_FIRE",
  branching: "BRANCHING",
  script: "SCRIPT_BUILDER",
  audit: "DIALOGUE_AUDIT",
  hotspot: "HOTSPOT",
  metaphor: "TASK_METAPHOR",
  eisenhower: "EISENHOWER",
  rule6040: "RULE_6040",
  smart: "SMART_GOAL",
  timeaudit: "TIME_AUDIT",
  clienttypes: "CLIENT_TYPES",
  ladder: "STAGE_LADDER",
  scale: "OBJECTION_SCALE",
  cart: "NEEDS_CART",
  economy: "ECONOMY_CALC",
  simulation: "SIMULATION",
};

interface PracticeToast {
  xp: number;
  stepDone: boolean;
}

const GROUPS: { key: Group; label: string; icon: typeof PlayCircle }[] = [
  { key: "watch", label: "Смотреть", icon: PlayCircle },
  { key: "materials", label: "Материалы", icon: BookOpen },
  { key: "practice", label: "Практика", icon: Dumbbell },
  { key: "tutor", label: "Наставник", icon: Bot },
];

export function LessonTabs({
  lessonId,
  videoReady,
  hasAudio = false,
  hasPodcast = false,
  watermark,
  startPositionSec,
  summary,
  transcript,
  notes = [],
  slides = null,
  hasSlidesPdf = false,
  flashcards = null,
  objections = null,
  branching = null,
  checklist = null,
  script = null,
  audit = null,
  hotspot = null,
  metaphor = null,
  eisenhower = null,
  rule6040 = null,
  smart = null,
  timeaudit = null,
  clientTypes = null,
  ladder = null,
  scale = null,
  cart = null,
  economy = null,
  simulation = null,
  quiz = null,
  voiceEnabled = false,
  subtitles = [],
  defaultSubtitleLang = null,
  practicedKinds = [],
  videoCompleted = false,
  quizPassed = false,
  nextLocked = false,
  initialTab = null,
}: {
  lessonId: string;
  videoReady: boolean;
  hasAudio?: boolean;
  hasPodcast?: boolean;
  watermark: string;
  startPositionSec: number;
  summary: string | null;
  transcript: string | null;
  notes?: NoteView[];
  slides?: SlideDeckData | null;
  hasSlidesPdf?: boolean;
  flashcards?: FlashcardsData | null;
  objections?: ObjectionsData | null;
  branching?: BranchingData | null;
  checklist?: ChecklistData | null;
  script?: ScriptBuilderData | null;
  audit?: DialogueAuditData | null;
  hotspot?: HotspotData | null;
  metaphor?: MetaphorData[] | null;
  eisenhower?: EisenhowerData | null;
  rule6040?: Rule6040Data | null;
  smart?: SmartGoalData | null;
  timeaudit?: TimeAuditData | null;
  clientTypes?: ClientTypesData | null;
  ladder?: StageLadderData | null;
  scale?: ObjectionScaleData | null;
  cart?: NeedsCartData | null;
  economy?: EconomyCalcData | null;
  simulation?: SimulationInfo | null;
  /** Задание к уроку (LESSON_QUIZ) — открывается на отдельной странице. */
  quiz?: { id: string; title: string } | null;
  voiceEnabled?: boolean;
  subtitles?: SubtitleTrackInfo[];
  defaultSubtitleLang?: string | null;
  /** Тренажёры этого урока, уже пройденные учеником (PracticeResult). */
  practicedKinds?: PracticeKind[];
  /** Видео урока досмотрено (LessonProgress.completedAt). */
  videoCompleted?: boolean;
  /** Задание урока сдано. */
  quizPassed?: boolean;
  /** Следующий урок закрыт до сдачи задания этого. */
  nextLocked?: boolean;
  /** «practice» — открыть урок сразу на главном тренажёре (ссылки из допуска к экзамену). */
  initialTab?: "practice" | null;
}) {
  const tabs: { key: Tab; label: string; icon: typeof PlayCircle; show: boolean; group: Group }[] = [
    { key: "video", label: "Видео", icon: PlayCircle, show: true, group: "watch" },
    { key: "podcast", label: "Подкаст", icon: Podcast, show: hasPodcast, group: "watch" },
    { key: "audio", label: "Аудиоверсия", icon: Headphones, show: hasAudio, group: "watch" },
    { key: "summary", label: "Конспект", icon: FileText, show: !!summary, group: "materials" },
    { key: "slides", label: "Презентация", icon: Presentation, show: !!slides || hasSlidesPdf, group: "materials" },
    { key: "transcript", label: "Транскрипт", icon: ScrollText, show: !!transcript, group: "materials" },
    { key: "notes", label: "Заметки", icon: StickyNote, show: true, group: "materials" },
    // Порядок внутри «Практики» задаёт practiceOrder ниже: главный тренажёр (с
    // пометкой «главный»), затем задание. Когда первыми стояли карточки с крупным
    // «ВОПРОС», ученики отвечали на них и не понимали, почему урок не засчитан —
    // поэтому карточки в главные не выбираются почти никогда (низ приоритета).
    { key: "quiz", label: "Задание", icon: GraduationCap, show: !!quiz, group: "practice" },
    { key: "flashcards", label: "Карточки", icon: Layers, show: !!flashcards, group: "practice" },
    { key: "objections", label: "Возражения", icon: MessageSquareWarning, show: !!objections, group: "practice" },
    { key: "rapidfire", label: "На скорость", icon: Zap, show: !!objections, group: "practice" },
    { key: "branching", label: "Сценарий", icon: GitBranch, show: !!branching, group: "practice" },
    { key: "script", label: "Скрипт", icon: ListOrdered, show: !!script, group: "practice" },
    { key: "audit", label: "Найди ошибку", icon: SearchCheck, show: !!audit, group: "practice" },
    { key: "checklist", label: "Чек-лист", icon: ListChecks, show: !!checklist, group: "practice" },
    { key: "hotspot", label: "Схема", icon: MapPin, show: !!hotspot, group: "practice" },
    { key: "metaphor", label: "Тренажёр", icon: PawPrint, show: !!metaphor?.length, group: "practice" },
    { key: "eisenhower", label: "Матрица", icon: Grid2x2, show: !!eisenhower, group: "practice" },
    { key: "rule6040", label: "60/40", icon: PieChart, show: !!rule6040, group: "practice" },
    { key: "smart", label: "SMART-цель", icon: Target, show: !!smart, group: "practice" },
    { key: "timeaudit", label: "Пожиратели", icon: Hourglass, show: !!timeaudit, group: "practice" },
    { key: "clienttypes", label: "Типы клиента", icon: Users, show: !!clientTypes, group: "practice" },
    { key: "ladder", label: "Лестница", icon: Milestone, show: !!ladder, group: "practice" },
    { key: "scale", label: "Весы", icon: Scale, show: !!scale, group: "practice" },
    { key: "cart", label: "Тележка", icon: ShoppingCart, show: !!cart, group: "practice" },
    { key: "economy", label: "Расчёт выгоды", icon: Calculator, show: !!economy, group: "practice" },
    { key: "simulation", label: "Симулятор", icon: MessagesSquare, show: !!simulation, group: "practice" },
    { key: "tutor", label: "Наставник", icon: Bot, show: true, group: "tutor" },
  ];

  const visible = tabs.filter((t) => t.show);

  // Главный тренажёр урока — шаг «Тренировка» между видео и заданием. Остальные
  // тренажёры прячутся под «Ещё»: семь равноправных вкладок практики ученики не
  // открывали вовсе — непонятно, с какой начать.
  const mainKind = pickMainTrainer(
    visible.map((t) => TAB_KIND[t.key]).filter((k): k is PracticeKind => !!k),
  );
  const mainTab = mainKind ? visible.find((t) => TAB_KIND[t.key] === mainKind)?.key ?? null : null;

  const [tab, setTab] = useState<Tab>(initialTab === "practice" && mainTab ? mainTab : "video");
  const reduceMotion = useReducedMotion();
  /** Подложка активной вкладки переезжает пружиной; при «уменьшить движение» — мгновенно. */
  const indicatorTransition = reduceMotion
    ? { duration: 0 }
    : ({ type: "spring", stiffness: 350, damping: 30 } as const);

  const [done, setDone] = useState<Set<PracticeKind>>(() => new Set(practicedKinds));
  const [videoDone, setVideoDone] = useState(videoCompleted);
  const [toast, setToast] = useState<PracticeToast | null>(null);
  const [showMore, setShowMore] = useState(false);
  const lessonPracticed = done.size > 0;

  // Открытие тренажёра — событие для аналитики (один раз за визит на вид).
  const opened = useRef(new Set<PracticeKind>());
  useEffect(() => {
    const kind = TAB_KIND[tab];
    if (!kind || opened.current.has(kind)) return;
    opened.current.add(kind);
    void reportPracticeAction({ lessonId, kind, phase: "open" });
  }, [tab, lessonId]);

  const onPracticeFinish = useCallback(
    (kind: PracticeKind, scorePct: number | null) => {
      void reportPracticeAction({ lessonId, kind, phase: "finish", scorePct }).then((res) => {
        if (!res.ok) return;
        setDone((s) => new Set(s).add(kind));
        if (res.data.firstTime) setToast({ xp: res.data.xpGained, stepDone: res.data.lessonStepDone });
      });
    },
    [lessonId],
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  // Порядок «Практики»: главный тренажёр → задание → остальные (под «Ещё»).
  const practiceOrder = (key: Tab) => (key === mainTab ? 0 : key === "quiz" ? 1 : 2);
  const groups = GROUPS.map((g) => ({
    ...g,
    items: visible
      .filter((t) => t.group === g.key)
      .sort((a, b) => (g.key === "practice" ? practiceOrder(a.key) - practiceOrder(b.key) : 0)),
  })).filter((g) => g.items.length > 0);

  const activeGroupKey = visible.find((t) => t.key === tab)?.group ?? groups[0]?.key;
  const activeGroup = groups.find((g) => g.key === activeGroupKey) ?? groups[0];

  const isExtra = (key: Tab) => !!TAB_KIND[key] && key !== mainTab;
  const extras = activeGroup?.key === "practice" ? activeGroup.items.filter((t) => isExtra(t.key)) : [];
  const extrasOpen = showMore || extras.some((t) => t.key === tab);
  const subTabs =
    activeGroup?.key === "practice" && extras.length > 1 && !extrasOpen
      ? activeGroup.items.filter((t) => !isExtra(t.key))
      : (activeGroup?.items ?? []);

  return (
    <PracticeProvider onFinish={onPracticeFinish}>
    <PlayerProvider onEnded={() => setVideoDone(true)}>
    <div>
      {/* Уровень 1 — группы форматов (на узких экранах прокручиваются) */}
      <div
        role="tablist"
        aria-label="Разделы урока"
        className="flex gap-1 overflow-x-auto rounded-xl bg-foreground/[0.04] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {groups.map((g) => {
          const active = g.key === activeGroup?.key;
          return (
            <button
              key={g.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(g.items[0]!.key)}
              className="relative flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              {active ? (
                <motion.span
                  layoutId="lesson-group"
                  className="absolute inset-0 rounded-lg bg-background shadow-sm"
                  transition={indicatorTransition}
                />
              ) : null}
              <span className={`relative z-10 flex items-center gap-1.5 ${active ? "text-amber-700" : "text-foreground/60"}`}>
                <g.icon className="size-4" />
                {g.label}
                {g.items.length > 1 ? (
                  <span className="rounded-full bg-foreground/10 px-1.5 text-[11px] font-semibold text-foreground/55">
                    {g.items.length}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      {/* Уровень 2 — вкладки внутри группы (только если их больше одной) */}
      {activeGroup && activeGroup.items.length > 1 ? (
        <div
          role="tablist"
          aria-label={`Форматы: ${activeGroup.label}`}
          className="mt-2 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {subTabs.map((t) => {
            const active = tab === t.key;
            const kind = TAB_KIND[t.key];
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={[
                  "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-transparent text-amber-700"
                    : "border-foreground/10 text-foreground/60 hover:bg-foreground/5",
                ].join(" ")}
              >
                {/* Подложка одна на весь ряд и переезжает между вкладками (как на уровне групп) */}
                {active ? (
                  <motion.span
                    layoutId="lesson-tab"
                    className="absolute inset-0 rounded-lg border border-amber-500/40 bg-amber-500/10"
                    transition={indicatorTransition}
                  />
                ) : null}
                <span className="relative z-10 flex items-center gap-1.5">
                  <t.icon className="size-4" />
                  {t.label}
                  {kind && done.has(kind) ? (
                    <CheckCircle2 aria-label="пройден" className="size-3.5 text-emerald-600" />
                  ) : t.key === mainTab ? (
                    <span className="rounded-full bg-amber-500/15 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      главный
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
          {subTabs.length < activeGroup.items.length ? (
            <button
              type="button"
              onClick={() => setShowMore(true)}
              className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-dashed border-foreground/15 px-3 py-1.5 text-sm font-medium text-foreground/55 transition-colors hover:bg-foreground/5"
            >
              Ещё тренажёры · {extras.length}
              <ChevronDown className="size-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Видео — всегда смонтировано, скрывается через display */}
      <div role="tabpanel" aria-label="Видео" className={`mt-4 ${tab === "video" ? "block" : "hidden"}`}>
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
        {videoDone && mainTab && mainKind && !lessonPracticed ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700">
                <Dumbbell className="size-5" />
              </div>
              <div>
                <p className="font-semibold">Видео просмотрено — закрепите на практике</p>
                <p className="text-sm text-foreground/60">
                  Тренажёр «{PRACTICE_LABELS[mainKind]}»: пара минут, +25 XP. Без практики знания уходят за неделю.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTab(mainTab)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
            >
              Начать тренировку
              <ChevronRight className="size-4" />
            </button>
          </motion.div>
        ) : null}
      </div>

      {/* Аудио — монтируется один раз (вне переключения вкладок), чтобы не рвать воспроизведение */}
      {hasPodcast ? (
        <div role="tabpanel" aria-label="Подкаст" className={`mt-4 ${tab === "podcast" ? "block" : "hidden"}`}>
          <AudioPlayer lessonId={lessonId} variant="podcast" />
        </div>
      ) : null}
      {hasAudio ? (
        <div role="tabpanel" aria-label="Аудиоверсия" className={`mt-4 ${tab === "audio" ? "block" : "hidden"}`}>
          <AudioPlayer lessonId={lessonId} variant="audio" />
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {tab === "slides" && (slides || hasSlidesPdf) ? (
          <motion.div
            key="slides"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4"
          >
            {/* PDF-презентация NotebookLM (встроенный слайдер) имеет приоритет над
                HTML-колодой; кнопка скачивания — внутри просмотрщика. */}
            {hasSlidesPdf ? (
              <PdfSlideViewer lessonId={lessonId} />
            ) : slides ? (
              <SlideDeck deck={slides} />
            ) : null}
          </motion.div>
        ) : null}

        {tab === "summary" && summary ? (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4"
          >
            <div className="mb-2 flex justify-end">
              <a
                href={`/api/learn/material/${lessonId}?type=summary`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
              >
                <Download className="size-4" />
                Скачать PDF
              </a>
            </div>
            <div className="prose-quiz rounded-2xl border border-foreground/10 bg-background p-6">
              <Markdown text={summary} />
            </div>
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

        {tab === "rapidfire" && objections ? (
          <motion.div
            key="rapidfire"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4"
          >
            <RapidFireDrill data={objections} />
          </motion.div>
        ) : null}

        {tab === "branching" && branching ? (
          <motion.div
            key="branching"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4"
          >
            <BranchingScenario data={branching} />
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
            <div className="mb-2 flex justify-end">
              <a
                href={`/api/learn/material/${lessonId}?type=checklist`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
              >
                <Download className="size-4" />
                Скачать PDF
              </a>
            </div>
            <ChecklistCard data={checklist} />
          </motion.div>
        ) : null}

        {tab === "hotspot" && hotspot ? (
          <motion.div key="hotspot" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
            <HotspotImage data={hotspot} />
          </motion.div>
        ) : null}

        {tab === "metaphor" && metaphor?.length ? (
          <motion.div key="metaphor" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
            <MetaphorTrainer items={metaphor} />
          </motion.div>
        ) : null}

        {tab === "eisenhower" && eisenhower ? (
          <motion.div key="eisenhower" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
            <EisenhowerMatrix data={eisenhower} />
          </motion.div>
        ) : null}

        {tab === "rule6040" && rule6040 ? (
          <motion.div key="rule6040" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
            <Rule6040 data={rule6040} />
          </motion.div>
        ) : null}

        {tab === "smart" && smart ? (
          <motion.div key="smart" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
            <SmartGoal data={smart} />
          </motion.div>
        ) : null}

        {tab === "timeaudit" && timeaudit ? (
          <motion.div key="timeaudit" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
            <TimeAudit data={timeaudit} />
          </motion.div>
        ) : null}

        {tab === "clienttypes" && clientTypes ? (
          <motion.div key="clienttypes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
            <ClientTypesTrainer data={clientTypes} />
          </motion.div>
        ) : null}

        {tab === "ladder" && ladder ? (
          <motion.div key="ladder" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
            <StageLadder data={ladder} />
          </motion.div>
        ) : null}

        {tab === "scale" && scale ? (
          <motion.div key="scale" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
            <ObjectionScale data={scale} />
          </motion.div>
        ) : null}

        {tab === "cart" && cart ? (
          <motion.div key="cart" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
            <NeedsCart data={cart} />
          </motion.div>
        ) : null}

        {tab === "economy" && economy ? (
          <motion.div key="economy" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
            <EconomyCalc data={economy} />
          </motion.div>
        ) : null}

        {tab === "simulation" && simulation ? (
          <motion.div key="simulation" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
            <SimulationChat scenario={simulation} voiceEnabled={voiceEnabled} />
          </motion.div>
        ) : null}

        {tab === "quiz" && quiz ? (
          <motion.div key="quiz" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
            <Link
              href={`/app/quiz/${quiz.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5 transition-colors hover:bg-amber-500/10"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700">
                  <GraduationCap className="size-5" />
                </div>
                <div>
                  <p className="font-semibold">{quiz.title}</p>
                  <p className="text-sm text-foreground/60">
                    Задание к уроку: проверьте, что усвоили материал. Пересдавать можно сколько угодно раз.
                  </p>
                </div>
              </div>
              <ChevronRight className="size-5 shrink-0 text-amber-700" />
            </Link>
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

        {tab === "notes" ? (
          <motion.div key="notes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
            <NotesPanel
              lessonId={lessonId}
              initialNotes={notes}
              hasVideo={videoReady}
              onJump={() => setTab("video")}
            />
          </motion.div>
        ) : null}

        {tab === "tutor" ? (
          <motion.div key="tutor" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
            <TutorChat lessonId={lessonId} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <LessonPath
        videoDone={videoDone}
        practice={mainTab && mainKind ? { label: PRACTICE_LABELS[mainKind], done: lessonPracticed } : null}
        quiz={quiz ? { id: quiz.id, title: quiz.title, passed: quizPassed } : null}
        nextLocked={nextLocked}
        onVideo={() => setTab("video")}
        onPractice={() => mainTab && setTab(mainTab)}
      />

      <AnimatePresence>
        {toast ? (
          <motion.div
            role="status"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-emerald-500/30 bg-background p-4 shadow-lg sm:left-auto sm:right-6"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700">
              <Dumbbell className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                Тренировка засчитана <span className="text-emerald-700">+{toast.xp} XP</span>
              </p>
              <p className="mt-0.5 text-sm text-foreground/60">
                {toast.stepDone && quiz && !quizPassed
                  ? "Шаг «Тренировка» пройден. Теперь задание — после практики оно даётся легче."
                  : "Ещё один тренажёр за плечами. Возвращайтесь к нему перед встречей с клиентом."}
              </p>
              {toast.stepDone && quiz && !quizPassed ? (
                <Link
                  href={`/app/quiz/${quiz.id}`}
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:underline"
                >
                  К заданию
                  <ChevronRight className="size-4" />
                </Link>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Закрыть"
              onClick={() => setToast(null)}
              className="text-foreground/40 transition-colors hover:text-foreground/70"
            >
              <X className="size-4" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
    </PlayerProvider>
    </PracticeProvider>
  );
}

/**
 * Путь урока: Видео → Тренировка → Задание. Раньше под уроком был один блок
 * «Проверь себя», и ученики шли «видео → тест», не заглядывая в практику. Теперь
 * тренировка — такой же шаг, как остальные, а текущий шаг подсвечен.
 */
function LessonPath({
  videoDone,
  practice,
  quiz,
  nextLocked,
  onVideo,
  onPractice,
}: {
  videoDone: boolean;
  practice: { label: string; done: boolean } | null;
  quiz: { id: string; title: string; passed: boolean } | null;
  nextLocked: boolean;
  onVideo: () => void;
  onPractice: () => void;
}) {
  type Step = {
    key: string;
    title: string;
    hint: string;
    done: boolean;
    icon: typeof PlayCircle;
    onClick?: () => void;
    href?: string;
  };
  const steps: Step[] = [
    { key: "video", title: "Видео", hint: videoDone ? "Просмотрено" : "Досмотрите до конца", done: videoDone, icon: PlayCircle, onClick: onVideo },
  ];
  if (practice) {
    steps.push({
      key: "practice",
      title: "Тренировка",
      hint: practice.done ? `«${practice.label}» — засчитано` : `«${practice.label}» · +25 XP`,
      done: practice.done,
      icon: Dumbbell,
      onClick: onPractice,
    });
  }
  if (quiz) {
    steps.push({
      key: "quiz",
      title: "Задание",
      hint: quiz.passed ? "Сдано" : nextLocked ? "Открывает следующий урок" : quiz.title,
      done: quiz.passed,
      icon: GraduationCap,
      href: `/app/quiz/${quiz.id}`,
    });
  }
  if (steps.length < 2) return null;
  const currentIdx = steps.findIndex((s) => !s.done);

  return (
    <div className="mt-5 rounded-2xl border border-foreground/10 bg-background p-3 sm:p-4">
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-foreground/45">
        {currentIdx === -1 ? "Урок пройден на 100%" : "Путь урока"}
      </p>
      <ol className={`mt-2 grid gap-2 ${steps.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {steps.map((s, i) => {
          const current = i === currentIdx;
          const body = (
            <span
              className={[
                "flex h-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                s.done
                  ? "border-emerald-500/25 bg-emerald-500/[0.05]"
                  : current
                    ? "border-amber-500/40 bg-amber-500/[0.08] hover:bg-amber-500/[0.12]"
                    : "border-foreground/10 hover:bg-foreground/[0.03]",
              ].join(" ")}
            >
              <span
                className={[
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  s.done ? "bg-emerald-500/15 text-emerald-700" : current ? "bg-amber-500/15 text-amber-700" : "bg-foreground/5 text-foreground/45",
                ].join(" ")}
              >
                <s.icon className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <span className="text-foreground/40">{i + 1}.</span>
                  {s.title}
                </span>
                <span className="block truncate text-xs text-foreground/55">{s.hint}</span>
              </span>
              {s.done ? (
                <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
              ) : current ? (
                <ChevronRight className="size-5 shrink-0 text-amber-700" />
              ) : (
                <Circle className="size-5 shrink-0 text-foreground/20" />
              )}
            </span>
          );
          return (
            <li key={s.key}>
              {s.href ? (
                <Link href={s.href} className="block h-full">
                  {body}
                </Link>
              ) : (
                <button type="button" onClick={s.onClick} className="block h-full w-full">
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Markdown-рендер с типографикой курса. GFM нужен для таблиц в конспектах. */
function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({ children }) => (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border-b border-foreground/15 px-3 py-2 text-left font-semibold text-foreground">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border-b border-foreground/10 px-3 py-2 align-top text-foreground/80">{children}</td>
        ),
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
