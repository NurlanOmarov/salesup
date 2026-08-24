import { describe, it, expect } from "vitest";
import {
  parseFlashcards,
  parseObjections,
  parseChecklist,
  parseScriptBuilder,
  parseDialogueAudit,
  parseHotspot,
  parseBranching,
  validateBranchingGraph,
  parseMetaphor,
  parseMetaphors,
  parseEisenhower,
  parseRule6040,
  parseSmartGoal,
  parseTimeAudit,
  parseClientTypes,
  parseStageLadder,
  parseObjectionScale,
  parseNeedsCart,
  type BranchingData,
} from "./interactive";

describe("parseFlashcards", () => {
  it("парсит валидный набор карточек", () => {
    const json = JSON.stringify({ cards: [{ front: "A", back: "B" }] });
    expect(parseFlashcards(json)).toEqual({ cards: [{ front: "A", back: "B" }] });
  });

  it("отбрасывает битые карточки, оставляя валидные", () => {
    const json = JSON.stringify({ cards: [{ front: "A", back: "B" }, { front: 1 }] });
    expect(parseFlashcards(json)).toEqual({ cards: [{ front: "A", back: "B" }] });
  });

  it("возвращает null на пустом/невалидном входе", () => {
    expect(parseFlashcards(null)).toBeNull();
    expect(parseFlashcards("{}")).toBeNull();
    expect(parseFlashcards("не json")).toBeNull();
    expect(parseFlashcards(JSON.stringify({ cards: [] }))).toBeNull();
  });
});

describe("parseObjections", () => {
  const valid = {
    items: [
      {
        objection: "Дорого",
        options: [
          { text: "Ответ 1", correct: true, feedback: "ок" },
          { text: "Ответ 2", correct: false, feedback: "нет" },
        ],
        tip: "подсказка",
      },
    ],
  };

  it("парсит валидный тренажёр", () => {
    expect(parseObjections(JSON.stringify(valid))).toEqual(valid);
  });

  it("отбрасывает элементы без правильного варианта или с одним вариантом", () => {
    const bad = {
      items: [
        { objection: "X", options: [{ text: "a", correct: false, feedback: "" }, { text: "b", correct: false, feedback: "" }] },
        { objection: "Y", options: [{ text: "a", correct: true, feedback: "" }] },
      ],
    };
    expect(parseObjections(JSON.stringify(bad))).toBeNull();
  });

  it("возвращает null на пустом/невалидном входе", () => {
    expect(parseObjections(null)).toBeNull();
    expect(parseObjections("{}")).toBeNull();
    expect(parseObjections(JSON.stringify({ items: [] }))).toBeNull();
  });
});

describe("parseChecklist", () => {
  it("парсит и отбрасывает битые пункты", () => {
    const json = JSON.stringify({ title: "T", items: [{ text: "a" }, { text: 1 }] });
    expect(parseChecklist(json)).toEqual({ title: "T", items: [{ text: "a" }] });
  });
  it("null на пустом", () => {
    expect(parseChecklist(JSON.stringify({ items: [] }))).toBeNull();
    expect(parseChecklist(null)).toBeNull();
  });
});

describe("parseScriptBuilder", () => {
  it("требует ≥3 шага", () => {
    const ok = { steps: [{ stage: "a", text: "1" }, { stage: "b", text: "2" }, { stage: "c", text: "3" }] };
    expect(parseScriptBuilder(JSON.stringify(ok))).toEqual(ok);
    expect(parseScriptBuilder(JSON.stringify({ steps: [{ stage: "a", text: "1" }] }))).toBeNull();
  });
});

describe("parseDialogueAudit", () => {
  it("требует хотя бы одну ошибочную реплику менеджера", () => {
    const ok = {
      items: [
        { speaker: "client", text: "c" },
        { speaker: "manager", text: "m", error: true, explanation: "e" },
      ],
    };
    expect(parseDialogueAudit(JSON.stringify(ok))).toEqual(ok);
    const noErr = { items: [{ speaker: "client", text: "c" }, { speaker: "manager", text: "m" }] };
    expect(parseDialogueAudit(JSON.stringify(noErr))).toBeNull();
  });
});

describe("parseHotspot", () => {
  it("требует изображение и ≥1 точку", () => {
    const ok = { image: "/x.png", points: [{ x: 1, y: 2, label: "l", text: "t" }] };
    expect(parseHotspot(JSON.stringify(ok))).toEqual({ image: "/x.png", caption: undefined, points: ok.points });
    expect(parseHotspot(JSON.stringify({ image: "/x.png", points: [] }))).toBeNull();
    expect(parseHotspot(JSON.stringify({ points: [{ x: 1, y: 2, label: "l", text: "t" }] }))).toBeNull();
  });
});

const validBranching: BranchingData = {
  title: "Холодный визит",
  start: "n1",
  nodes: [
    { id: "n1", npc: "Мне некогда.", choices: [{ text: "Уделите минуту", to: "n2" }, { text: "Ухожу", to: "end_lose" }] },
    { id: "n2", npc: "Ну говорите.", choices: [{ text: "Презентую выгоду", to: "end_win" }] },
    { id: "end_win", npc: "Оставьте материалы.", outcome: "win", outcomeText: "Контакт установлен" },
    { id: "end_lose", npc: "Всего доброго.", outcome: "lose", outcomeText: "Визит сорван" },
  ],
};

describe("validateBranchingGraph", () => {
  it("принимает корректный граф", () => {
    expect(validateBranchingGraph(validBranching)).toBe(true);
  });

  it("отвергает несуществующий стартовый узел", () => {
    expect(validateBranchingGraph({ ...validBranching, start: "missing" })).toBe(false);
  });

  it("отвергает переход в несуществующий узел", () => {
    expect(
      validateBranchingGraph({ start: "n1", nodes: [{ id: "n1", npc: "x", choices: [{ text: "y", to: "ghost" }] }] }),
    ).toBe(false);
  });

  it("требует хотя бы один терминальный узел (цикл без выхода → false)", () => {
    expect(
      validateBranchingGraph({
        start: "a",
        nodes: [
          { id: "a", npc: "x", choices: [{ text: "→b", to: "b" }] },
          { id: "b", npc: "y", choices: [{ text: "→a", to: "a" }] },
        ],
      }),
    ).toBe(false);
  });

  it("отвергает дубликаты id", () => {
    expect(
      validateBranchingGraph({
        start: "a",
        nodes: [
          { id: "a", npc: "x", choices: [{ text: "→a", to: "a" }] },
          { id: "a", npc: "y" },
        ],
      }),
    ).toBe(false);
  });
});

describe("parseBranching", () => {
  it("парсит валидный JSON", () => {
    expect(parseBranching(JSON.stringify(validBranching))?.nodes).toHaveLength(4);
  });

  it("null при битом/пустом/сломанном", () => {
    expect(parseBranching(null)).toBeNull();
    expect(parseBranching("{не json")).toBeNull();
    expect(parseBranching(JSON.stringify({ start: "x", nodes: [] }))).toBeNull();
    expect(parseBranching(JSON.stringify({ ...validBranching, start: "ghost" }))).toBeNull();
  });
});

describe("parseMetaphor", () => {
  it("парсит валидную метафору «слон»", () => {
    const json = JSON.stringify({
      variant: "elephant",
      title: "Съешь слона",
      prompt: "Разбей на куски",
      goal: 5,
    });
    expect(parseMetaphor(json)).toMatchObject({ variant: "elephant", goal: 5 });
  });

  it("зажимает goal в диапазон 2..12", () => {
    const mk = (goal: number) =>
      parseMetaphor(JSON.stringify({ variant: "elephant", title: "t", prompt: "p", goal }));
    expect(mk(100)?.goal).toBe(12);
    expect(mk(1)?.goal).toBe(2);
  });

  it("по умолчанию goal=3 для nails и 5 для остальных", () => {
    expect(
      parseMetaphor(JSON.stringify({ variant: "nails", title: "t", prompt: "p" }))?.goal,
    ).toBe(3);
    expect(
      parseMetaphor(JSON.stringify({ variant: "frog", title: "t", prompt: "p" }))?.goal,
    ).toBe(5);
  });

  it("null при неизвестном варианте или битом входе", () => {
    expect(parseMetaphor(JSON.stringify({ variant: "dragon", title: "t", prompt: "p" }))).toBeNull();
    expect(parseMetaphor(JSON.stringify({ variant: "elephant", title: 1, prompt: "p" }))).toBeNull();
    expect(parseMetaphor(null)).toBeNull();
    expect(parseMetaphor("{не json")).toBeNull();
  });
});

describe("parseMetaphors", () => {
  it("парсит массив {items:[...]}", () => {
    const json = JSON.stringify({
      items: [
        { variant: "frog", title: "f", prompt: "p" },
        { variant: "elephant", title: "e", prompt: "p", goal: 5 },
        { variant: "nails", title: "n", prompt: "p" },
      ],
    });
    const r = parseMetaphors(json);
    expect(r?.map((m) => m.variant)).toEqual(["frog", "elephant", "nails"]);
  });

  it("принимает legacy-форму (один объект) и отбрасывает битые", () => {
    expect(parseMetaphors(JSON.stringify({ variant: "elephant", title: "t", prompt: "p" }))).toHaveLength(1);
    expect(parseMetaphors(JSON.stringify({ items: [{ variant: "dragon" }] }))).toBeNull();
    expect(parseMetaphors(null)).toBeNull();
  });
});

describe("parseEisenhower", () => {
  it("парсит и ограничивает seedTasks", () => {
    const r = parseEisenhower(JSON.stringify({ title: "t", prompt: "p", seedTasks: ["a", "b", 3] }));
    expect(r).toMatchObject({ title: "t", prompt: "p" });
    expect(r?.seedTasks).toEqual(["a", "b"]);
  });
  it("null без title/prompt", () => {
    expect(parseEisenhower(JSON.stringify({ title: "t" }))).toBeNull();
    expect(parseEisenhower(null)).toBeNull();
  });
});

describe("parseRule6040", () => {
  it("парсит и зажимает dayHours 1..16, часы задач", () => {
    const r = parseRule6040(JSON.stringify({ title: "t", prompt: "p", dayHours: 99, seedTasks: [{ text: "a", hours: 50 }] }));
    expect(r?.dayHours).toBe(16);
    expect(r?.seedTasks?.[0]?.hours).toBe(16);
  });
  it("dayHours по умолчанию 8; null без title/prompt", () => {
    expect(parseRule6040(JSON.stringify({ title: "t", prompt: "p" }))?.dayHours).toBe(8);
    expect(parseRule6040(JSON.stringify({ title: "t" }))).toBeNull();
    expect(parseRule6040(null)).toBeNull();
  });
});

describe("parseSmartGoal", () => {
  it("парсит title/prompt/placeholder", () => {
    expect(parseSmartGoal(JSON.stringify({ title: "t", prompt: "p", goalPlaceholder: "g" }))).toEqual({
      title: "t",
      prompt: "p",
      goalPlaceholder: "g",
    });
  });
  it("null без обязательных полей", () => {
    expect(parseSmartGoal(JSON.stringify({ prompt: "p" }))).toBeNull();
    expect(parseSmartGoal(null)).toBeNull();
  });
});

describe("parseTimeAudit", () => {
  it("парсит и фильтрует активности", () => {
    const r = parseTimeAudit(
      JSON.stringify({ title: "t", prompt: "p", seedActivities: [{ text: "a", hours: 2, waster: true }, { text: "b" }] }),
    );
    expect(r?.seedActivities).toHaveLength(1);
    expect(r?.seedActivities?.[0]).toMatchObject({ text: "a", hours: 2, waster: true });
  });
  it("null без обязательных полей", () => {
    expect(parseTimeAudit(JSON.stringify({ title: "t" }))).toBeNull();
    expect(parseTimeAudit(null)).toBeNull();
  });
});

describe("parseClientTypes", () => {
  const card = {
    quote: "А поговорить?",
    type: "green",
    hint: "Зелёный ищет одобрения",
    reactions: [
      { text: "Расспросить", correct: true, feedback: "верно" },
      { text: "Поверить «да-да»", correct: false, feedback: "слабо" },
    ],
  };

  it("парсит валидный набор карточек", () => {
    const r = parseClientTypes(JSON.stringify({ title: "t", prompt: "p", cards: [card] }));
    expect(r?.cards).toHaveLength(1);
    expect(r?.cards[0]?.type).toBe("green");
  });

  it("отбрасывает карточку с неизвестным типом", () => {
    expect(parseClientTypes(JSON.stringify({ cards: [{ ...card, type: "purple" }] }))).toBeNull();
  });

  it("отбрасывает карточку без верной реакции", () => {
    const reactions = card.reactions.map((r) => ({ ...r, correct: false }));
    expect(parseClientTypes(JSON.stringify({ cards: [{ ...card, reactions }] }))).toBeNull();
  });

  it("null на битом JSON и пустом контенте", () => {
    expect(parseClientTypes("{")).toBeNull();
    expect(parseClientTypes(null)).toBeNull();
  });
});

describe("parseStageLadder", () => {
  const valid = {
    stepTitles: ["A", "B", "C", "D", "E"],
    reactionCards: [
      { clientLine: "плохо", positive: false, explanation: "откат" },
      { clientLine: "хорошо", positive: true, explanation: "закрытие" },
    ],
  };

  it("парсит валидную лестницу", () => {
    const r = parseStageLadder(JSON.stringify(valid));
    expect(r?.stepTitles).toHaveLength(5);
    expect(r?.reactionCards[0]?.positive).toBe(false);
    expect(r?.reactionCards[1]?.positive).toBe(true);
  });

  it("отбрасывает, если ступеней не ровно 5", () => {
    expect(parseStageLadder(JSON.stringify({ ...valid, stepTitles: ["A", "B"] }))).toBeNull();
  });

  it("отбрасывает, если карточек не ровно 2", () => {
    expect(parseStageLadder(JSON.stringify({ ...valid, reactionCards: [valid.reactionCards[0]] }))).toBeNull();
  });

  it("отбрасывает, если порядок карточек не негатив→позитив", () => {
    const swapped = { ...valid, reactionCards: [valid.reactionCards[1], valid.reactionCards[0]] };
    expect(parseStageLadder(JSON.stringify(swapped))).toBeNull();
  });

  it("null на битом JSON и пустом контенте", () => {
    expect(parseStageLadder("{")).toBeNull();
    expect(parseStageLadder(null)).toBeNull();
  });
});

describe("parseObjectionScale", () => {
  const round = {
    objection: "Дорого",
    options: [
      { text: "Оправдание", positive: false, feedback: "минус" },
      { text: "Позитив", positive: true, feedback: "плюс" },
    ],
  };

  it("парсит валидные раунды", () => {
    const r = parseObjectionScale(JSON.stringify({ rounds: [round] }));
    expect(r?.rounds).toHaveLength(1);
  });

  it("отбрасывает раунд без позитивного варианта", () => {
    const onlyNegative = { ...round, options: [round.options[0], { ...round.options[0], text: "Ещё оправдание" }] };
    const r = parseObjectionScale(JSON.stringify({ rounds: [onlyNegative] }));
    expect(r).toBeNull();
  });

  it("отбрасывает раунд без оправдания", () => {
    const onlyPositive = { ...round, options: [round.options[1], { ...round.options[1], text: "Ещё позитив" }] };
    const r = parseObjectionScale(JSON.stringify({ rounds: [onlyPositive] }));
    expect(r).toBeNull();
  });

  it("null, если раундов нет вовсе", () => {
    expect(parseObjectionScale(JSON.stringify({ rounds: [] }))).toBeNull();
  });

  it("null на битом JSON и пустом контенте", () => {
    expect(parseObjectionScale("{")).toBeNull();
    expect(parseObjectionScale(null)).toBeNull();
  });
});

describe("parseNeedsCart", () => {
  const questions = [
    { text: "Открытый?", kind: "open" },
    { text: "Альтернативный?", kind: "alt" },
    { text: "Закрытый?", kind: "closed" },
  ];

  it("парсит валидный пул вопросов", () => {
    const r = parseNeedsCart(JSON.stringify({ questions }));
    expect(r?.questions).toHaveLength(3);
  });

  it("отбрасывает, если вопросов меньше трёх", () => {
    expect(parseNeedsCart(JSON.stringify({ questions: questions.slice(0, 2) }))).toBeNull();
  });

  it("отбрасывает, если все вопросы одного типа", () => {
    const sameKind = [
      { text: "1?", kind: "open" },
      { text: "2?", kind: "open" },
      { text: "3?", kind: "open" },
    ];
    expect(parseNeedsCart(JSON.stringify({ questions: sameKind }))).toBeNull();
  });

  it("отбрасывает вопрос с неизвестным kind, но считает остальные", () => {
    const withBad = [...questions, { text: "?", kind: "weird" }];
    const r = parseNeedsCart(JSON.stringify({ questions: withBad }));
    expect(r?.questions).toHaveLength(3);
  });

  it("null на битом JSON и пустом контенте", () => {
    expect(parseNeedsCart("{")).toBeNull();
    expect(parseNeedsCart(null)).toBeNull();
  });
});
