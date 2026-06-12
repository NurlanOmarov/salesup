import { spawn } from "node:child_process";

export class CommandError extends Error {
  constructor(
    readonly command: string,
    readonly code: number | null,
    readonly stderr: string,
  ) {
    super(`Команда «${command}» завершилась с кодом ${code}`);
    this.name = "CommandError";
  }
}

/**
 * Запустить внешний процесс (yt-dlp/ffmpeg/ffprobe), вернуть stdout.
 * stderr копится для диагностики; при `onStderr` строки также стримятся
 * (ffmpeg пишет прогресс в stderr).
 */
export function run(
  cmd: string,
  args: string[],
  opts: { onStderr?: (line: string) => void; cwd?: string } = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd });
    let stdout = "";
    let stderr = "";
    let buf = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => {
      const text = d.toString();
      stderr += text;
      if (opts.onStderr) {
        buf += text;
        const lines = buf.split(/\r|\n/);
        buf = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) opts.onStderr(line);
      }
    });

    child.on("error", (err) => {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") {
        reject(new Error(`Не найдена команда «${cmd}». Установите её (brew install ${cmd}).`));
      } else {
        reject(err);
      }
    });
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new CommandError(cmd, code, stderr));
    });
  });
}

/** Проверка наличия и работоспособности бинарника в PATH.
 *  ffmpeg/ffprobe используют одиночный `-version`; прочие — `--version`. */
export async function requireBinary(cmd: string, hint: string): Promise<void> {
  const versionArg = cmd === "ffmpeg" || cmd === "ffprobe" ? "-version" : "--version";
  try {
    await run(cmd, [versionArg]);
  } catch (e) {
    const detail = e instanceof Error ? ` (${e.message})` : "";
    throw new Error(`Не найден или не работает «${cmd}»${detail}. ${hint}`);
  }
}
