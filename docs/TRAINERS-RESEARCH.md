# Тренажёры для уроков — международный опыт и предложения

> Исследование: какие интерактивные тренажёры можно добавить к урокам SalesAcademy.
> Опора на международный опыт (sales-роулплеи, геймифицированный edtech, корпоративные академии).
> Рынок: медпреды / B2B, Казахстан, русский язык. Стек: Next.js 15 + Prisma + Anthropic (Haiku/Sonnet) + Job/cron-воркер, без сторонних сервисов.

---

## Что уже есть в проекте (база — 18 типов)

**Квиз-вопросы (`QuestionType`):** SINGLE_CHOICE · MULTI_CHOICE · TRUE_FALSE · ORDERING · FILL_BLANK · MATCHING · CATEGORIZATION · PRACTICE · SCENARIO

**Интерактивные артефакты (`AiArtifactType`):** SUMMARY · SLIDES · FLASHCARDS · OBJECTIONS · CHECKLIST · SCRIPT_BUILDER · DIALOGUE_AUDIT · HOTSPOT

**Симуляции (`SimulationScenario`):** SIMULATION (текстовый диалог с AI-клиентом)

Из них настоящие **тренажёры**: ObjectionTrainer, ScriptBuilder, DialogueAudit, SimulationChat, FlashcardsDeck, HotspotImage, Scenario-квиз.
Анимация уже используется: Framer Motion (stagger, 3D-flip карточек, Reorder drag, slide-переходы, expand/collapse, scale-popup).

---

## Чего НЕТ из того, что делают лидеры

### 🔴 Приоритет 1 — ядро, дёшево на текущем стеке (Anthropic + Job/cron)

#### 1. AI Voice Roleplay — голосовой звонок с AI-клиентом
- **Что делает ученик:** жмёт «Позвонить», говорит вслух → STT → Haiku отвечает голосом (TTS) в роли врача; AI давит на слабый opener, вбрасывает возражения, задаёт follow-up.
- **Тренирует:** реальный визит/звонок (не «печатание»).
- **Кто так делает:** Hyperbound, Second Nature, Quantified.ai, PitchMonster, Yoodli, Mindtickle, Allego, Highspot. Тренд 2024–2026: voice-first с первого дня, безлимитные сессии.
- **⚠️ Оговорка:** требует внешних STT/TTS API → идёт против правила «один сервер / без сторонних сервисов». Самый большой «вау», но это отдельное продуктовое решение → вторая очередь.

#### 2. Персоны клиента с настроением (mood / persona)
- **Что делает ученик:** выбирает/получает персону: *занятой врач · скептик-завотделением · закупщик · дружелюбный, но не назначает*; курс задаёт «настроение».
- **Тренирует:** адаптацию под тип ЛПР.
- **Кто:** Second Nature (менеджер задаёт mood), Mindtickle (десятки персон), Hyperbound (персоны из реальных звонков).
- **Реализация:** расширение `SimulationChat` одним системным промптом — почти бесплатно.

#### 3. Scorecard по фазам визита (рубрика после симуляции)
- **Что делает ученик:** после симуляции видит балл по фазам: *открытие → выявление потребности → презентация с доказательной базой → возражения → закрытие на назначение*.
- **Тренирует:** понимание, на какой фазе провал.
- **Кто:** Hyperbound, Mindtickle, Highspot, Attention (MEDDIC/BANT), PitchMonster.
- **Реализация:** переиспользует AI-критика (порог 80 уже есть). Показывать разбивкой с прогресс-барами по фазам.

#### 4. Compliance instant-fail — уникально для фармы 🎯
- **Что делает ученик:** при необоснованном обещании эффективности / off-label / забытом дисклеймере → мгновенный «красный флаг» (instant fail).
- **Тренирует:** соблюдение требований к продвижению препаратов.
- **Кто:** Quantified.ai (AI Compliance Agent, для фармы US). Общие edtech этого НЕ делают → killer-feature для рынка.
- **Реализация:** ложится на AI-критика.

#### 5. Spaced repetition — тренажёр интервального повторения 🎯
- **Что делает ученик:** карточки (МНН, показания, дозировки) возвращаются по интервалам 1-3-7-30 дней; сложность подстраивается под ответы.
- **Тренирует:** долгосрочное удержание номенклатуры (против кривой забывания Эббингауза).
- **Кто:** Mindtickle (Adaptive Spaced Reinforcement), Duolingo (Half-Life Regression, +12% engagement).
- **Реализация:** **идеально ложится на таблицу Job + cron-воркер** — без внешних сервисов. Для MVP — упрощённый Leitner/SuperMemo (1-3-7-30); HLR — целевая планка. Самый «родной» по архитектуре пункт.

---

### 🟡 Приоритет 2 — сильный эффект, средняя сложность

#### 6. Branching scenario — ветвящийся диалог с последствиями
- **Что делает ученик:** на каждом шаге выбирает реплику → диалог ветвится → разные исходы (назначил / отказал). Фокус на суждении, а не запоминании.
- **Тренирует:** принятие решений в безопасной среде.
- **Кто:** Articulate Storyline / Adobe Captivate / Twine (явное дерево), Mindtickle (дерево + scoring) vs **Allego (эмерджентное ветвление через LLM по системному промпту)**.
- **Реализация:** путь Allego — не рисовать дерево вручную, дать LLM системный промпт. Дёшево и гибко на Haiku/Sonnet. Явное дерево — только для ключевых «эталонных» кейсов.

#### 7. Rapid-fire objection drill — возражения на время ⏱️
- **Что делает ученик:** отвечает на поток возражений под таймер, без подготовки; очки за скорость + качество, серия правильных ответов.
- **Тренирует:** «мышцу возражений» — быстрый уверенный ответ под давлением.
- **Кто:** классические sales-тренинги (The Objection Deck, timed polls) + AI-версии (Hyperbound).
- **Реализация:** режим поверх существующего `ObjectionTrainer` + таймер. Хорошо геймифицируется.

#### 8. Speech coaching — слова-паразиты, темп, паузы
- **Что делает ученик:** видит метрики подачи: % «эээ/как бы», темп (WPM), длину пауз, clarity, подсветку проблемных фраз.
- **Тренирует:** чистоту и уверенность подачи.
- **Кто:** Yoodli (ядро: filler words → цель ~4%, pace, eye contact), PitchMonster («Sales Grammarly»).
- **⚠️ Оговорка:** требует аудио (как и #1) → вторая очередь.

---

### 🟢 Приоритет 3 — мотивационный слой (из Duolingo)

#### 9. Streak + Streak Freeze
- ≥1 занятие в день; «заморозка» спасает пропуск. Поднимает среднюю серию с 11.62 до 17.19 дня (данные Duolingo). Голый streak без freeze демотивирует при первом срыве.
- **Кто:** Duolingo, Brilliant. **Реализация:** счётчики на существующей таблице `Event`.

#### 10. XP / уровни / бейджи / лиги
- XP за активность, недельная лига (~30 человек), бейджи, достижения. Лиги работают и на лидеров, и на середняков.
- **Кто:** Duolingo (10 тиров до Diamond), Brilliant, DataCamp, Mindtickle, Highspot.

#### 11. Daily Quests / Daily Goals
- Мини-цели дня, ученик сам выбирает норму (5–20 мин). Достижение цели в день 1 → retention 33% против 20%.
- **Кто:** Duolingo.

#### 12. Маскот / AI-наставник как лицо платформы
- Персонаж радуется/грустит при угрозе серии — антропоморфизм поднимает ставки. У проекта уже есть AI-наставник в ТЗ → можно дать ему «лицо».
- **Кто:** Duolingo (сова Duo).

---

## Дополнительные форматы (из edtech, для микро-тренажёров теории)

#### 13. «Добрый» мгновенный фидбек
Ошибка не штрафует: объяснение + верный вариант, прогресс-бар продолжает идти. Снижает страх практики. **Кто:** Duolingo, Brilliant, DataCamp.

#### 14. Адаптивная сложность
Легко прошёл → усложнить; тяжело → замедлить и закрепить базу. **Кто:** Duolingo (Birdbrain), Brilliant.

#### 15. Explorable / learn-by-doing
Ученик сразу с задачи (без лекции), двигает ползунки/объекты, видит реакцию вживую. Анимированные диаграммы реального времени. **Кто:** Brilliant.org (движок Rive), Codecademy, DataCamp.

---

## Где сложная анимация ОПРАВДАНА

Анимация — не самоцель. Работает там, где усиливает обучение/мотивацию; мешает там, где отвлекает от текста.

| Тренажёр | Анимация | Стоит ли |
|---|---|---|
| Branching scenario | дерево-карта пути, ветка «прорастает» при выборе (GSAP/Framer path) | ✅ да — визуализирует последствия |
| Spaced repetition | карта прогресса памяти, «угасающая» карточка перед повтором | ✅ да — делает невидимое видимым |
| Streak / XP / лиги | огонёк, конфетти, подъём по тирам, маскот-наставник | ✅ да — эмоция = удержание |
| Rapid-fire drill | таймер-кольцо, комбо-счётчик, тряска при ошибке | ✅ да — драйв скорости |
| HotspotImage / схема | есть scale-popup; можно SVG-морфинг анатомии | 🟡 умеренно |
| Voice roleplay | говорящий аватар-врач (мимика, Rive/Lottie) | 🟡 дорого, вторая очередь |
| Quiz-вопросы (choice/fill/match) | уже есть stagger | 🔴 не усложнять |

**Чем делать сложную анимацию** (Framer Motion уже в проекте):
- **Rive** — основа интерактивных explorable Brilliant.org (анатомия, схемы); state-machine анимации, реагируют на действия ученика.
- **Lottie** — маскот-наставник, празднования, микро-награды.
- **GSAP** — ветвящиеся деревья, timeline-сценарии.
- **Framer Motion** (`layoutId` + `AnimatePresence`, уже используется) — хватит для 80% переходов.

---

## Рекомендуемая последовательность внедрения

1. **Прокачать `SimulationChat`** (#2 персоны + #3 scorecard по фазам + #4 compliance-флаги). Всё через Haiku/критика, нулевые внешние зависимости, максимальный прирост ценности. ← начать отсюда
2. **Spaced-repetition тренажёр на Job/cron** (#5) поверх существующих флешкарт — закрепление номенклатуры препаратов.
3. **Branching scenario (LLM-режим)** (#6) + **rapid-fire objection drill с таймером** (#7) — два новых типа упражнений с оправданной анимацией.
4. **Мотивационный слой** (#9–12) — streak + freeze, XP/лиги, daily quests.
5. **Вторая очередь (нужны STT/TTS, против правила «один сервер»):** voice roleplay (#1), speech coaching (#8) — отдельное продуктовое решение.

---

## Приложение A. AI Voice Roleplay — реализация, токены, ограничения

> Детализация тренажёра №1. Важно: **токены — самая дешёвая часть**. Реальная стоимость и архитектурная проблема — внешние STT/TTS (против правила «один сервер»).

### A.1. Как устроено (архитектура потока)

```
[Ученик говорит] → mic
   → STT (speech-to-text)         ← внешний API (Whisper-class / Deepgram / Google)
   → текст реплики ученика
   → LLM (Haiku) в роли врача     ← Anthropic, единственная «токеновая» часть
   → текст ответа AI
   → TTS (text-to-speech)         ← внешний API (Google/Azure дёшево, ElevenLabs дорого)
   → [AI отвечает голосом]
   ↑ цикл, пока ученик не завершит или не достигнут лимит реплик
В конце:
   → один вызов Haiku на весь транскрипт → Scorecard по фазам + compliance-флаги
```

Переиспользуем существующее: `SimulationChat` (логика диалога), `SimulationScenario` (персона/сценарий), `AiUsageDay` + `lib/ai/limits.ts` (лимиты), `lib/ai/critic.ts` (финальный скоринг), таблица `Event` (учёт). Добавляется только голосовой слой (STT/TTS) поверх уже текстового диалога.

### A.2. Сколько уходит токенов

Токены тратит только LLM-часть. **STT/TTS — это минуты аудио и символы, не токены.**

Расчёт на один звонок (реалистичный визит медпреда, ~12 реплик с каждой стороны, русский язык):

| Параметр | Значение |
|---|---|
| Системный промпт (персона + инструкции + RAG-контекст урока) | ~1 500 токенов |
| Средняя реплика (ученик / AI), разговорная, на русском | ~60 токенов |
| Реплик ученика за звонок (= число вызовов LLM) | 12 |

История диалога переотправляется на каждом ходе → квадратичный рост входа:

- **Input итого:** ≈ Σ(1 500 + история) ≈ **~26 600 input-токенов** за звонок
- **Output итого:** ≈ 12 × 60 ≈ **~720 output-токенов** за звонок
- Финальный скоринг (1 вызов на весь транскрипт): ~2 000 input + ~400 output

**Стоимость на Haiku 4.5 ($1/M input, $5/M output):**

| Сценарий | Стоимость за звонок |
|---|---|
| Диалог без кеширования | ~$0.027 input + ~$0.004 output ≈ **$0.03** |
| Диалог + prompt caching (системка + RAG в кеше, чтение ×0.1) | ≈ **$0.01–0.015** |
| + финальный скоринг | + ~$0.004 |
| **Итого с кешем** | **≈ $0.015–0.02 за звонок (~7–9 ₸)** |

Вывод: **1 000 голосовых звонков на Haiku ≈ $15–20 токенов.** Это пренебрежимо мало.

### A.3. Где настоящая стоимость — STT/TTS

Звонок на 12 реплик ≈ 3–5 минут аудио:

| Слой | Дёшево | Дорого (премиум-голос) |
|---|---|---|
| STT (~4 мин) | Deepgram/Whisper ~$0.024 | — |
| TTS (~2 400 символов AI-реплик) | Google/Azure ~$0.036 | ElevenLabs ~$0.40+ |
| **TTS — главный драйвер цены и качества** | | |

**STT+TTS на дешёвых провайдерах ≈ $0.06/звонок — в 3–4 раза дороже всех токенов.** На премиум-TTS (ElevenLabs) — в 20+ раз дороже. Плюс это внешние сервисы → конфликт с правилом «один сервер / только Anthropic+OpenAI-embeddings». Поэтому voice — отдельное продуктовое решение, не MVP.

### A.4. Как ограничить расход (по убыванию эффекта)

**Архитектурные (режут токены/стоимость кратно):**
1. **Только Haiku** для диалога, никогда Sonnet. Sonnet здесь не нужен.
2. **Prompt caching** на системный промпт + RAG-контекст урока (`cache_control`). Чтение кеша ×0.1 — экономит ~50–60% входа на многоходовом диалоге.
3. **Триммить контекст:** в системку класть только релевантные RAG-чанки текущего урока, не весь транскрипт.
4. **Ограничить длину истории:** не растить контекст бесконечно — после N реплик суммировать ранние ходы в 1–2 предложения (или скользящее окно последних ~8 реплик).
5. **Скоринг — один раз в конце**, на полном транскрипте, а не на каждом ходе.

**Продуктовые лимиты (на твоём стеке уже есть инфраструктура):**
6. **Лимит реплик на звонок** (напр. макс 15) → авто-завершение. Уже частично есть в `SimulationScenario` (лимит реплик/день).
7. **Дневной/недельный лимит звонков на ученика** через `AiUsageDay` + `lib/ai/limits.ts` — проверка ДО вызова API (как требует правило №4 в CLAUDE.md).
8. **Бюджет-гард:** оценка стоимости до старта; блок, если ученик исчерпал дневной лимит AI.
9. **Минуты аудио как отдельный лимит** (для STT/TTS): напр. 15 мин голоса/день на ученика — режет именно дорогую часть.

**По STT/TTS (если всё же внедрять):**
10. Дешёвый TTS (Google/Azure) по умолчанию; премиум-голос — опционально/платно.
11. Рассмотреть on-device Web Speech API в браузере (бесплатный STT/TTS на стороне клиента) для MVP-версии — нулевая внешняя стоимость, ценой качества.
12. Кешировать TTS фиксированных фраз (приветствие персоны, типовые реплики), не синтезировать заново.

### A.5. Рекомендация

- **Фаза 1 (сейчас):** прокачать текстовый `SimulationChat` (персоны, scorecard, compliance) — нулевая внешняя зависимость, токены ~$0.02/сессия.
- **Фаза 2 (voice, опционально):** сначала браузерный Web Speech API (бесплатно, проверить спрос), потом — платные STT/TTS с жёсткими лимитами минут на ученика.
- Токенов бояться не нужно: на Haiku даже тысячи звонков стоят единицы долларов. Контролировать надо **минуты аудио** и **число сессий**, а не токены.

---

## Приложение B. Дизайн прокачки текстового `SimulationChat` (Фаза 1)

> Три фичи приоритета 1 поверх существующего кода: **персоны+настроение** (#2), **scorecard по фазам** (#3), **compliance instant-fail** (#4). Все изменения схемы — **аддитивные**: старые поля `persona`/`objectives`/`scorePct`/`debrief` остаются, ничего не ломается. Затрагиваемые файлы: [prisma/schema.prisma](../prisma/schema.prisma), [src/lib/ai/simulate.ts](../src/lib/ai/simulate.ts), [src/lib/ai/prompts/simulate.ts](../src/lib/ai/prompts/simulate.ts), [src/components/learn/simulation-chat.tsx](../src/components/learn/simulation-chat.tsx).

### B.1. Изменения Prisma-схемы (additive)

```prisma
// Тип ЛПР — устойчивый характер собеседника
enum PersonaArchetype {
  BUSY_DOCTOR            // занятой врач: мало времени, перебивает
  SKEPTIC                // скептик-завотделением: требует доказательств
  PROCUREMENT            // закупщик: давит на цену/условия
  FRIENDLY_NONCOMMITTAL  // дружелюбный, но не назначает
  AGGRESSIVE             // негативный/закрытый
}

model SimulationScenario {
  // ... существующие поля без изменений ...
  archetype       PersonaArchetype @default(BUSY_DOCTOR)
  difficulty      Int              @default(2)  // 1..3 — насколько упирается клиент
  complianceRules Json?            // string[]: запрещённые/обязательные формулировки
  rubric          Json?            // PhaseSpec[] | null → используется дефолтная рубрика
}

model SimulationRun {
  // ... существующие поля без изменений (scorePct, debrief остаются) ...
  scorecard       Json?            // Scorecard (см. B.2) — разбивка по фазам
  complianceFlags Json?            // ComplianceFlag[]
  passed          Boolean?         // false при любом fail-флаге (instant-fail)
}
```

Миграция безопасна: новые поля nullable / с дефолтами, старые прогоны остаются валидными. `scorePct`/`debrief` продолжают заполняться (= `scorecard.overallPct` / `scorecard.topTip`) для обратной совместимости старого UI.

### B.2. Структура Scorecard (TS-типы, кладутся в `lib/ai/simulate.ts`)

```ts
export type SimPhase = "opening" | "discovery" | "presentation" | "objections" | "closing";

export interface PhaseScore {
  phase: SimPhase;
  label: string;     // «Выявление потребности»
  score: number;     // 0..100
  comment: string;   // 1 короткое предложение по фазе
}

export interface ComplianceFlag {
  severity: "fail" | "warn";
  rule: string;        // что нарушено
  quote: string;       // дословная реплика ученика
  explanation: string; // почему это нарушение и как правильно
}

export interface Scorecard {
  phases: PhaseScore[];
  overallPct: number;          // 0..100, средневзвешенное по фазам
  passed: boolean;             // false, если есть хоть один flag severity="fail"
  complianceFlags: ComplianceFlag[];
  strengths: string[];         // 1-2 пункта
  improvements: string[];      // 1-2 пункта
  topTip: string;              // 1 конкретный совет
}
```

**Дефолтная рубрика фаз для медпредов** (используется, если `scenario.rubric` пуст):

```ts
export const DEFAULT_RUBRIC: { phase: SimPhase; label: string; weight: number }[] = [
  { phase: "opening",      label: "Открытие визита",            weight: 0.15 },
  { phase: "discovery",    label: "Выявление потребности",      weight: 0.25 },
  { phase: "presentation", label: "Презентация с доказательной базой", weight: 0.25 },
  { phase: "objections",   label: "Работа с возражениями",      weight: 0.20 },
  { phase: "closing",      label: "Закрытие на следующий шаг",  weight: 0.15 },
];
```

### B.3. Промпты

**Обновлённый `clientSystem`** — учитывает архетип, настроение и сложность. Стабильную часть (правила) выносим в кешируемый блок:

```ts
const ARCHETYPE_BEHAVIOR: Record<PersonaArchetype, string> = {
  BUSY_DOCTOR:           "Ты постоянно занят, у тебя мало времени. Перебиваешь, требуешь краткости, поглядываешь на часы.",
  SKEPTIC:               "Ты опытный и недоверчивый. Требуешь доказательств, ссылок на исследования, ставишь под сомнение заявления.",
  PROCUREMENT:           "Тебя интересуют цена, условия поставки, скидки. Давишь на коммерцию, сравниваешь с конкурентами.",
  FRIENDLY_NONCOMMITTAL: "Ты приветлив и охотно общаешься, но избегаешь конкретных обязательств. Тянешь с решением.",
  AGGRESSIVE:            "Ты раздражён и закрыт. Отвечаешь резко, не хочешь разговора, нужно заслужить твоё внимание.",
};

export function clientSystem(
  persona: string,
  objectives: string[],
  archetype: PersonaArchetype,
  difficulty: number, // 1..3
): string {
  const resistance = difficulty <= 1 ? "Сопротивляйся слабо, легко идёшь навстречу."
    : difficulty >= 3 ? "Сопротивляйся сильно: уступай только при действительно грамотной работе."
    : "Сопротивляйся умеренно, проверяй менеджера.";
  return [
    "Ты играешь роль КЛИЕНТА (врача/ЛПР) в тренажёре по продажам. Веди себя как живой человек, не ассистент.",
    "", "Твоя персона:", persona,
    "", "Характер этого собеседника:", ARCHETYPE_BEHAVIOR[archetype], resistance,
    "", "Чему ученик должен научиться:", ...objectives.map((o) => `— ${o}`),
    "", "Правила:",
    "1. Отвечай ТОЛЬКО как клиент, 1-2 короткими репликами на русском. Без ремарок.",
    "2. Будь реалистичным: сомневайся, возражай. Не сдавайся слишком легко.",
    "3. Если менеджер работает грамотно — теплей; если давит/ошибается — сопротивляйся.",
    "4. Не выходи из роли, не подсказывай, не оценивай. Просто реагируй.",
  ].join("\n");
}
```

**Новый `SCORECARD_SYSTEM`** — заменяет `DEBRIEF_SYSTEM`, возвращает структуру B.2 + compliance instant-fail:

```ts
export function scorecardSystem(complianceRules: string[]): string {
  return [
    "Ты — наставник по фарм-продажам. Разбери диалог менеджера (ученика) с врачом/ЛПР.",
    "",
    "Оцени каждую фазу визита по 0-100 и дай по ней 1 короткий комментарий:",
    "— opening (Открытие): представился, получил внимание, обозначил цель визита",
    "— discovery (Выявление потребности): задавал вопросы о пациентах/практике врача",
    "— presentation (Презентация): аргументировал выгодами + доказательной базой",
    "— objections (Возражения): отрабатывал сомнения без давления",
    "— closing (Закрытие): продвинул к следующему шагу (назначение/повторный визит)",
    "",
    "COMPLIANCE (критично). Отметь нарушения как флаги:",
    "— severity=fail: необоснованное обещание эффективности («100% вылечит», «лучше всех» без данных),",
    "  продвижение вне показаний (off-label), обещание личной выгоды закупщику.",
    "— severity=warn: упоминание дозировки без отсылки к инструкции, преувеличения.",
    "Любой флаг severity=fail → passed=false, независимо от баллов по фазам.",
    ...(complianceRules.length
      ? ["", "Дополнительные правила этого сценария:", ...complianceRules.map((r) => `— ${r}`)]
      : []),
    "",
    "Верни СТРОГО JSON по схеме:",
    '{ "phases":[{"phase","label","score","comment"}], "overallPct":<0-100>,',
    '  "passed":<bool>, "complianceFlags":[{"severity","rule","quote","explanation"}],',
    '  "strengths":[..1-2..], "improvements":[..1-2..], "topTip":"<1 совет>" }',
    "Честно, но поддерживающе. На русском, по делу.",
  ].join("\n");
}
```

### B.4. Изменения в `simulate.ts`

- `replyAsClient` — пробросить `archetype`/`difficulty` в `clientSystem`. (опц.) включить prompt caching на системный блок через `cache_control` в `anthropic.ts` — экономит вход на длинном диалоге.
- `debriefRun` → `scoreRun`: вызвать `completeJson<Scorecard>` с `scorecardSystem(complianceRules)`, посчитать `overallPct` как взвешенное по `DEFAULT_RUBRIC`, проставить `passed = !flags.some(f => f.severity==="fail")`. Сохранить в `SimulationRun`: `scorecard`, `complianceFlags`, `passed`, плюс для совместимости `scorePct = overallPct`, `debrief = topTip`.
- `loadScenario` — добавить в `select` поля `archetype`, `difficulty`, `complianceRules`.

### B.5. UI — отображение scorecard (`simulation-chat.tsx`)

После завершения вместо одного абзаца:
- **Полоски по фазам** (5 шт.) — `score` как заполнение, цвет по порогу (зелёный ≥80 / жёлтый 60-79 / красный <60). Анимация роста полоски (Framer `motion.div` width 0→score, stagger по фазам).
- **Большой бейдж passed/failed**: при `passed=false` из-за compliance — красная плашка «⚠️ Нарушение требований» с цитатой и пояснением (важнее общего балла).
- **Сильные стороны / зоны роста** — два коротких списка.
- **topTip** — выделенный блок с одним советом.
- Compliance-флаги `warn` — мягким жёлтым, `fail` — красным с цитатой реплики.

### B.6. Где взять данные сценария (генерация/seed)

Сценарии с `archetype`/`difficulty`/`complianceRules` генерируются так же, как остальной контент (вручную в Claude Code → seed, по [content-generation-workflow]), валидируются критиком (правило №5), публикуются `validation=VALIDATED`. На урок можно держать несколько сценариев разных архетипов/сложности — ученик выбирает «с кем потренироваться».

### B.7. Бюджет токенов прокачки

Диалог — тот же Haiku, ~$0.02/сессия (см. Приложение A). Скоринг возвращает структурный JSON на русском: `maxTokens=1800` (важно — на меньшем лимите ответ обрезается и JSON не парсится; проверено вживую), ~2 500 input + до ~1 500 output ≈ +$0.01. Итого по-прежнему **~$0.02–0.03 за полную сессию**. Лимит `AiUsageDay.simulations` (20/день) уже защищает. В `scoreRun` есть один ретрай парсинга перед graceful-fallback.

---

## Источники

**Sales-тренажёры:** [Hyperbound](https://www.hyperbound.ai/product/ai-sales-roleplays) · [Second Nature](https://secondnature.ai/product/) · [Quantified](https://www.quantified.ai/platform) · [PitchMonster](https://www.pitchmonster.io/) · [Yoodli](https://yoodli.ai/blog/how-to-stop-using-filler-words) · [Gong talk-to-listen](https://www.gong.io/blog/talk-to-listen-conversion-ratio)

**Корпоративные академии:** [Mindtickle Adaptive Spaced Reinforcements](https://www.mindtickle.com/news/adaptive-spaced-reinforcements-knowledge-retention/) · [Mindtickle AI Role Play](https://www.mindtickle.com/platform/ai-sales-role-play/) · [Allego Agentic AI](https://www.allego.com/news/allego-unveils-agentic-ai-for-sales/) · [Highspot AI Role Play](https://www.highspot.com/product/ai-role-play/)

**Геймифицированный edtech:** [Duolingo gamification](https://trophy.so/blog/duolingo-gamification-case-study) · [Duolingo HLR paper](https://research.duolingo.com/papers/settles.acl16.pdf) · [Birdbrain](https://venturebeat.com/ai/how-duolingo-uses-ai-in-every-part-of-its-app) · [Brilliant learn by doing](https://brilliant.org/about/) · [Rive — Brilliant animations](https://rive.app/blog/how-brilliant-org-motivates-learners-with-rive-animations)

**Branching & timed drills:** [Articulate branching scenarios](https://www.articulate.com/blog/e-learning-branching-scenarios/) · [Twine scenario learning](https://www.learningguild.com/articles/use-twine-to-easily-create-engaging-immersive-scenario-based-learning) · [Objection handling games](https://www.hbwleads.com/blog/objection-handling-training-games-to-play-with-your-sales-team/)
