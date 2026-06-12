import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { run } from "./exec.js";

/**
 * HLS-кодирование исходника в AES-128-шифрованные дорожки (CLAUDE.md, видео-стек).
 * Чистые функции (лесенка качеств, master.m3u8, key_info) отделены от I/O и покрыты
 * юнит-тестами; ffprobe/ffmpeg вызываются через exec.run.
 */

export interface Quality {
  name: string; // "720p"
  height: number; // 720
  videoBitrate: string; // "2800k"
  audioBitrate: string; // "128k"
  bandwidth: number; // для master.m3u8 (видео+аудио, бит/с)
}

// Лесенка качеств (720p + 480p по ТЗ S2.1). Порядок — от высокого к низкому.
export const LADDER: Quality[] = [
  { name: "720p", height: 720, videoBitrate: "2800k", audioBitrate: "128k", bandwidth: 2_928_000 },
  { name: "480p", height: 480, videoBitrate: "1400k", audioBitrate: "128k", bandwidth: 1_528_000 },
];

/**
 * Выбрать качества, не превышающие высоту исходника (без апскейла).
 * Гарантирует минимум одно качество — самое низкое, даже если источник ещё ниже.
 */
export function selectLadder(sourceHeight: number): Quality[] {
  const fit = LADDER.filter((q) => q.height <= sourceHeight);
  if (fit.length > 0) return fit;
  const lowest = LADDER[LADDER.length - 1];
  return lowest ? [lowest] : [];
}

/** Содержимое master.m3u8 со ссылками на варианты. */
export function buildMasterPlaylist(qualities: Quality[]): string {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];
  for (const q of qualities) {
    const width = Math.round((q.height * 16) / 9);
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${q.bandwidth},RESOLUTION=${width}x${q.height}`,
    );
    lines.push(`${q.name}/playlist.m3u8`);
  }
  return lines.join("\n") + "\n";
}

/**
 * Содержимое key_info_file для ffmpeg `-hls_key_info_file`. Три строки:
 *   1) URI ключа, как он попадёт в EXT-X-KEY плейлиста (наш защищённый эндпоинт);
 *   2) локальный путь к файлу ключа (ffmpeg читает 16 байт для шифрования);
 *   3) IV в hex.
 */
export function keyInfoContent(keyUri: string, keyPath: string, ivHex: string): string {
  return `${keyUri}\n${keyPath}\n${ivHex}\n`;
}

/** Случайный IV (16 байт) в hex для HLS AES-128. */
export function randomIvHex(): string {
  return randomBytes(16).toString("hex");
}

// ─────────────────────────── I/O ───────────────────────────

/** Длительность медиа в секундах (округлённая вверх) через ffprobe. */
export async function probeDurationSec(file: string): Promise<number> {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  const sec = parseFloat(stdout.trim());
  if (!Number.isFinite(sec)) throw new Error(`ffprobe не вернул длительность для ${file}`);
  return Math.ceil(sec);
}

/** Высота видеопотока в пикселях через ffprobe. */
export async function probeHeight(file: string): Promise<number> {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=height",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  const h = parseInt(stdout.trim(), 10);
  if (!Number.isFinite(h)) throw new Error(`ffprobe не вернул высоту для ${file}`);
  return h;
}

/**
 * Транскодировать исходник в одно HLS-качество с AES-128.
 * Пишет `<outDir>/<quality>/playlist.m3u8` и сегменты `seg_NNNN.ts`.
 */
export async function transcodeQuality(opts: {
  input: string;
  outDir: string;
  quality: Quality;
  keyInfoPath: string;
  segmentSec: number;
  onProgress?: (line: string) => void;
}): Promise<void> {
  const { input, outDir, quality, keyInfoPath, segmentSec, onProgress } = opts;
  const qDir = join(outDir, quality.name);
  await mkdir(qDir, { recursive: true });

  await run(
    "ffmpeg",
    [
      "-y",
      "-i", input,
      "-vf", `scale=-2:${quality.height}`,
      "-c:v", "libx264",
      "-profile:v", "main",
      "-preset", "veryfast",
      "-b:v", quality.videoBitrate,
      "-maxrate", quality.videoBitrate,
      "-bufsize", "2M",
      // фиксированный GOP для ровной нарезки сегментов
      "-g", "48",
      "-keyint_min", "48",
      "-sc_threshold", "0",
      "-c:a", "aac",
      "-b:a", quality.audioBitrate,
      "-ac", "2",
      "-hls_time", String(segmentSec),
      "-hls_playlist_type", "vod",
      "-hls_key_info_file", keyInfoPath,
      "-hls_segment_filename", join(qDir, "seg_%04d.ts"),
      join(qDir, "playlist.m3u8"),
    ],
    { onStderr: onProgress },
  );
}

/** Рекурсивный список файлов в каталоге (относительные POSIX-пути). */
export async function listFilesRecursive(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (d: string, prefix: string): Promise<void> => {
    const entries = await readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(join(d, e.name), rel);
      else out.push(rel);
    }
  };
  await walk(dir, "");
  return out.sort();
}

/** Суммарный размер файлов (байты). */
export async function dirSize(dir: string): Promise<number> {
  const files = await listFilesRecursive(dir);
  let total = 0;
  for (const f of files) total += (await stat(join(dir, f))).size;
  return total;
}

export { readFile, writeFile };
