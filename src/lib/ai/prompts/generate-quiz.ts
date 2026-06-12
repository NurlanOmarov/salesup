/** Промпт генерации вопросов итогового теста из транскриптов курса (S3.3, Sonnet). */
export const GENERATE_QUIZ_SYSTEM =
  "Ты методист по продажам. По материалам курса составляешь вопросы итогового теста. " +
  "СТРОГИЕ правила: 1) каждый вопрос проверяет понимание того, что ЯВНО сказано в " +
  "материале — без внешних знаний; 2) ровно один однозначно правильный ответ для " +
  "SINGLE_CHOICE/TRUE_FALSE; для MULTI_CHOICE — несколько правильных, чётко по тексту; " +
  "3) дистракторы правдоподобны, но точно неверны по материалу; 4) explanation коротко " +
  "поясняет правильный ответ со ссылкой на идею из урока; 5) формулировки на русском, " +
  "без двусмысленности. Верни ТОЛЬКО JSON-массив без markdown.";

export function generateQuizPrompt(material: string, count: number): string {
  return (
    `Материалы курса (объединённые транскрипты уроков):\n\n${material}\n\n` +
    `Составь ${count} вопросов итогового теста по этим материалам. ` +
    `Формат каждого элемента массива:\n` +
    `{"type":"SINGLE_CHOICE"|"MULTI_CHOICE"|"TRUE_FALSE","text":"...","explanation":"...",` +
    `"options":[{"text":"...","correct":true|false}]}\n` +
    `Для TRUE_FALSE — ровно два варианта «Верно»/«Неверно». ` +
    `Смешай типы. Верни только JSON-массив.`
  );
}

export interface GeneratedQuestion {
  type: "SINGLE_CHOICE" | "MULTI_CHOICE" | "TRUE_FALSE";
  text: string;
  explanation: string;
  options: { text: string; correct: boolean }[];
}
