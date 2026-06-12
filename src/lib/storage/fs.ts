import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import type { StorageDriver } from "./types.js";
import { normalizeKey } from "./key.js";

/**
 * Файловый драйвер хранилища: пишет/читает в каталог MEDIA_ROOT (volume на VPS).
 * Все ключи нормализуются и дополнительно проверяется, что итоговый абсолютный
 * путь не выходит за пределы root — двойная защита от traversal.
 */
export class FsStorage implements StorageDriver {
  readonly name = "fs" as const;
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  /** Ключ → абсолютный путь с проверкой, что он внутри root. */
  private resolveKey(key: string): string {
    const norm = normalizeKey(key);
    const abs = resolve(this.root, norm);
    const rel = relative(this.root, abs);
    if (rel.startsWith("..") || rel.startsWith(sep) || resolve(this.root, rel) !== abs) {
      throw new Error(`Ключ "${key}" выходит за пределы хранилища`);
    }
    return abs;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  async put(key: string, data: Buffer | string): Promise<void> {
    const abs = this.resolveKey(key);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, data);
  }

  async putStream(key: string, stream: Readable): Promise<void> {
    const abs = this.resolveKey(key);
    await mkdir(dirname(abs), { recursive: true });
    await pipeline(stream, createWriteStream(abs));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  async list(prefix: string): Promise<string[]> {
    // prefix может указывать на «каталог»; нормализуем как ключ-папку
    const norm = normalizeKey(prefix);
    const base = resolve(this.root, norm);
    const out: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return; // префикса нет — пустой список
      }
      for (const e of entries) {
        const full = join(dir, e.name);
        if (e.isDirectory()) {
          await walk(full);
        } else {
          out.push(relative(this.root, full).split(sep).join("/"));
        }
      }
    };
    await walk(base);
    return out.sort();
  }

  publicUrl(): string | null {
    // fs-драйвер не отдаёт публичных URL напрямую — раздача только через nginx.
    return null;
  }
}
