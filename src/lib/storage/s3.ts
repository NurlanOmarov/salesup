import type { Readable } from "node:stream";
import type { StorageDriver } from "./types.js";

/**
 * Заглушка S3-драйвера для миграции на вариант А (S3 ps.kz) — docs/MIGRATION.md.
 * Интерфейс готов; реализация подключается при переключении STORAGE_DRIVER=s3.
 * TODO(S6.5): реализовать через @aws-sdk/client-s3 (endpoint/bucket/ключи из env).
 */
export class S3Storage implements StorageDriver {
  readonly name = "s3" as const;

  constructor(_config: {
    endpoint?: string;
    bucket?: string;
    accessKey?: string;
    secretKey?: string;
  }) {
    // конфиг сохранится при реализации
  }

  private notImplemented(): never {
    throw new Error("S3Storage ещё не реализован (см. docs/MIGRATION.md, S6.5)");
  }

  exists(_key: string): Promise<boolean> {
    return this.notImplemented();
  }
  get(_key: string): Promise<Buffer> {
    return this.notImplemented();
  }
  put(_key: string, _data: Buffer | string): Promise<void> {
    return this.notImplemented();
  }
  putStream(_key: string, _stream: Readable): Promise<void> {
    return this.notImplemented();
  }
  delete(_key: string): Promise<void> {
    return this.notImplemented();
  }
  list(_prefix: string): Promise<string[]> {
    return this.notImplemented();
  }
  publicUrl(_key: string): string | null {
    return this.notImplemented();
  }
}
