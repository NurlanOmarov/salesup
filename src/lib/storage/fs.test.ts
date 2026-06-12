import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { FsStorage } from "./fs.js";

describe("FsStorage", () => {
  let root: string;
  let storage: FsStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "salesup-storage-"));
    storage = new FsStorage(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("put + get round-trip", async () => {
    await storage.put("courses/x/lessons/a/note.txt", "привет");
    const buf = await storage.get("courses/x/lessons/a/note.txt");
    expect(buf.toString("utf8")).toBe("привет");
  });

  it("exists отражает наличие объекта", async () => {
    expect(await storage.exists("courses/x/a.txt")).toBe(false);
    await storage.put("courses/x/a.txt", "1");
    expect(await storage.exists("courses/x/a.txt")).toBe(true);
  });

  it("putStream пишет из потока", async () => {
    await storage.putStream(
      "courses/x/seg.bin",
      Readable.from([Buffer.from("ab"), Buffer.from("cd")]),
    );
    expect((await storage.get("courses/x/seg.bin")).toString()).toBe("abcd");
  });

  it("delete идемпотентен", async () => {
    await storage.put("courses/x/a.txt", "1");
    await storage.delete("courses/x/a.txt");
    await storage.delete("courses/x/a.txt"); // повторно — без ошибки
    expect(await storage.exists("courses/x/a.txt")).toBe(false);
  });

  it("list возвращает ключи по префиксу", async () => {
    await storage.put("courses/x/a.txt", "1");
    await storage.put("courses/x/sub/b.txt", "2");
    await storage.put("courses/y/c.txt", "3");
    const keys = await storage.list("courses/x");
    expect(keys).toEqual(["courses/x/a.txt", "courses/x/sub/b.txt"]);
  });

  it("list по несуществующему префиксу — пустой массив", async () => {
    expect(await storage.list("courses/none")).toEqual([]);
  });

  it("отклоняет traversal-ключ", async () => {
    await expect(storage.get("../../../etc/passwd")).rejects.toThrow();
  });

  it("publicUrl всегда null для fs", () => {
    expect(storage.publicUrl()).toBeNull();
  });
});
