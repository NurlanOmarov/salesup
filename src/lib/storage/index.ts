import { env } from "@/env";
import { FsStorage } from "./fs.js";
import { S3Storage } from "./s3.js";
import type { StorageDriver } from "./types.js";

export type { StorageDriver } from "./types.js";
export { InvalidStorageKeyError, normalizeKey } from "./key.js";
export { FsStorage } from "./fs.js";
export { S3Storage } from "./s3.js";

function createStorage(): StorageDriver {
  if (env.STORAGE_DRIVER === "s3") {
    return new S3Storage({
      endpoint: env.S3_ENDPOINT,
      bucket: env.S3_BUCKET,
      accessKey: env.S3_ACCESS_KEY,
      secretKey: env.S3_SECRET_KEY,
    });
  }
  return new FsStorage(env.MEDIA_ROOT);
}

/** Единый экземпляр хранилища для приложения и фабрики. */
export const storage: StorageDriver = createStorage();
