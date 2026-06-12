/**
 * Минималистичный парсер аргументов CLI (без зависимостей — принцип «один сервер,
 * минимум сторонних пакетов»). Поддерживает позиционные аргументы, `--flag value`
 * и булевы `--flag`.
 */
export interface ParsedArgs {
  positionals: string[];
  options: Record<string, string | boolean>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const options: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        options[key] = next;
        i++;
      } else {
        options[key] = true;
      }
    } else {
      positionals.push(arg);
    }
  }

  return { positionals, options };
}

/** Достать строковую опцию или бросить с подсказкой по использованию. */
export function requireOption(
  args: ParsedArgs,
  key: string,
  usage: string,
): string {
  const v = args.options[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new Error(`Не задан --${key}. Использование: ${usage}`);
  }
  return v;
}
