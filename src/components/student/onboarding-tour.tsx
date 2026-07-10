"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PlayCircle, Repeat, StickyNote, Bot, ArrowRight, Check } from "lucide-react";
import { completeOnboardingAction } from "@/app/(student)/app/actions";

/**
 * Приветственный тур при первом входе в кабинет (показывается, пока User.onboardedAt
 * не заполнен). Центрированный модал-карусель — без хрупкой привязки к элементам.
 * Закрытие (пройти/пропустить) отмечает онбординг завершённым на сервере.
 */
const STEPS = [
  {
    icon: PlayCircle,
    title: "Продолжайте с того места, где остановились",
    text: "На главной — кнопка «Продолжить обучение» и прогресс по каждому курсу. Урок засчитывается автоматически после просмотра.",
  },
  {
    icon: Repeat,
    title: "Повторение закрепляет знания",
    text: "Карточки терминов и приёмов возвращаются по интервалам. Бейдж в меню подскажет, сколько карточек ждёт повторения сегодня.",
  },
  {
    icon: StickyNote,
    title: "Записывайте удачные формулировки",
    text: "Во время урока на вкладке «Заметки» сохраняйте мысли и скрипты — они привяжутся к секунде видео, чтобы быстро вернуться.",
  },
  {
    icon: Bot,
    title: "AI-наставник всегда рядом",
    text: "Задавайте вопросы по материалу урока — наставник ответит на основе содержания курса. А в симуляторе можно потренировать звонок.",
  },
];

export function OnboardingTour() {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step]!;
  const Icon = current.icon;

  async function finish() {
    setClosing(true);
    setOpen(false);
    await completeOnboardingAction({}).catch(() => {});
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-label="Знакомство с кабинетом"
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24 }}
          className="w-full max-w-md overflow-hidden rounded-3xl border border-foreground/10 bg-background p-6 shadow-xl"
        >
          <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700">
            <Icon className="size-7" />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="mt-4 text-lg font-bold">{current.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground/65">{current.text}</p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex items-center justify-between">
            <div className="flex gap-1.5" aria-hidden>
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? "w-5 bg-amber-500" : "w-1.5 bg-foreground/15"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {!isLast ? (
                <button
                  onClick={finish}
                  disabled={closing}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/55 hover:text-foreground"
                >
                  Пропустить
                </button>
              ) : null}
              <button
                onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
                disabled={closing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
              >
                {isLast ? (
                  <>
                    <Check className="size-4" />
                    Начать
                  </>
                ) : (
                  <>
                    Далее
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
