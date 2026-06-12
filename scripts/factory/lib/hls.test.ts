import { describe, it, expect } from "vitest";
import {
  selectLadder,
  buildMasterPlaylist,
  keyInfoContent,
  randomIvHex,
  LADDER,
} from "./hls.js";

describe("selectLadder", () => {
  it("источник 1080p → оба качества (без апскейла, 720+480)", () => {
    expect(selectLadder(1080).map((q) => q.name)).toEqual(["720p", "480p"]);
  });

  it("источник ровно 720p → 720p и 480p", () => {
    expect(selectLadder(720).map((q) => q.name)).toEqual(["720p", "480p"]);
  });

  it("источник 600p → только 480p (720 был бы апскейлом)", () => {
    expect(selectLadder(600).map((q) => q.name)).toEqual(["480p"]);
  });

  it("источник 360p → минимум одно качество (480p), не пусто", () => {
    expect(selectLadder(360).map((q) => q.name)).toEqual(["480p"]);
  });
});

describe("buildMasterPlaylist", () => {
  it("содержит заголовок и оба варианта", () => {
    const m = buildMasterPlaylist(LADDER);
    expect(m).toContain("#EXTM3U");
    expect(m).toContain("#EXT-X-VERSION:3");
    expect(m).toContain("720p/playlist.m3u8");
    expect(m).toContain("480p/playlist.m3u8");
  });

  it("корректные RESOLUTION и BANDWIDTH для 720p (16:9)", () => {
    const m = buildMasterPlaylist(selectLadder(720).slice(0, 1));
    expect(m).toContain("RESOLUTION=1280x720");
    expect(m).toContain("BANDWIDTH=2928000");
  });

  it("заканчивается переводом строки", () => {
    expect(buildMasterPlaylist(LADDER).endsWith("\n")).toBe(true);
  });
});

describe("keyInfoContent", () => {
  it("три строки: URI, путь, IV", () => {
    const content = keyInfoContent(
      "/api/video/key/lesson123",
      "/tmp/out/key.bin",
      "0".repeat(32),
    );
    expect(content.split("\n")).toEqual([
      "/api/video/key/lesson123",
      "/tmp/out/key.bin",
      "0".repeat(32),
      "",
    ]);
  });

  it("URI ключа — наш защищённый эндпоинт, не локальный путь", () => {
    const content = keyInfoContent("/api/video/key/abc", "/tmp/key.bin", randomIvHex());
    const uri = content.split("\n")[0];
    expect(uri).toBe("/api/video/key/abc");
    expect(uri).not.toContain("/tmp");
  });
});

describe("randomIvHex", () => {
  it("32 hex-символа (16 байт)", () => {
    expect(randomIvHex()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("каждый вызов уникален", () => {
    expect(randomIvHex()).not.toBe(randomIvHex());
  });
});
