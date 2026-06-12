import type { Readable } from "node:stream";

/**
 * Абстракция хранилища медиа (CLAUDE.md, правило 3 / готовность к миграции).
 * Код ВЕЗДЕ оперирует относительными ключами вида `courses/<slug>/lessons/<id>/...`,
 * никогда — абсолютными путями. Драйвер `fs` сейчас, `s3` после переезда (D-003).
 */
export interface StorageDriver {
  readonly name: "fs" | "s3";

  /** Существует ли объект по ключу. */
  exists(key: string): Promise<boolean>;

  /** Прочитать объект целиком (для небольших файлов: m3u8, vtt, json). */
  get(key: string): Promise<Buffer>;

  /** Записать объект (создаёт промежуточные «каталоги»). */
  put(key: string, data: Buffer | string): Promise<void>;

  /** Записать объект из потока (большие файлы: сегменты видео). */
  putStream(key: string, stream: Readable): Promise<void>;

  /** Удалить объект (идемпотентно — отсутствующий ключ не ошибка). */
  delete(key: string): Promise<void>;

  /** Список ключей с заданным префиксом (для идемпотентности фабрики, манифеста). */
  list(prefix: string): Promise<string[]>;

  /**
   * Публичный URL для НЕзащищённых ассетов (обложки, трейлеры).
   * Для защищённого медиа возвращает null — раздаётся только через
   * X-Accel-Redirect после серверной проверки доступа (правило 2).
   */
  publicUrl(key: string): string | null;
}
