import { describe, it, expect } from "vitest";
import {
  rewriteMasterPlaylist,
  rewriteMediaPlaylist,
  parseSegmentKey,
} from "./hls-rewrite.js";

const MASTER = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=2928000,RESOLUTION=1280x720
720p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1528000,RESOLUTION=853x480
480p/playlist.m3u8
`;

const MEDIA = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-KEY:METHOD=AES-128,URI="/api/video/key/lesson1",IV=0xabc
#EXTINF:6.000000,
seg_0000.ts
#EXTINF:6.000000,
seg_0001.ts
#EXT-X-ENDLIST
`;

describe("rewriteMasterPlaylist", () => {
  it("заменяет ссылки на варианты, сохраняя теги", () => {
    const out = rewriteMasterPlaylist(MASTER, (v) => `/api/video/playlist/lesson1?v=${v}`);
    expect(out).toContain("/api/video/playlist/lesson1?v=720p");
    expect(out).toContain("/api/video/playlist/lesson1?v=480p");
    expect(out).toContain("#EXT-X-STREAM-INF:BANDWIDTH=2928000,RESOLUTION=1280x720");
    expect(out).not.toContain("720p/playlist.m3u8");
  });

  it("не трогает строки-теги и пустые строки", () => {
    const out = rewriteMasterPlaylist(MASTER, () => "X");
    expect(out.split("\n")[0]).toBe("#EXTM3U");
  });
});

describe("rewriteMediaPlaylist", () => {
  it("переписывает сегменты на подписанные URL", () => {
    const out = rewriteMediaPlaylist(
      MEDIA,
      (s) => `/api/video/media/courses/c/lessons/l/720p/${s}?exp=1&sig=ab`,
      "/api/video/key/lesson1",
    );
    expect(out).toContain("/api/video/media/courses/c/lessons/l/720p/seg_0000.ts?exp=1&sig=ab");
    expect(out).toContain("/api/video/media/courses/c/lessons/l/720p/seg_0001.ts?exp=1&sig=ab");
    expect(out).not.toMatch(/^seg_0000\.ts$/m);
  });

  it("заменяет URI ключа в EXT-X-KEY, сохраняя METHOD и IV", () => {
    const out = rewriteMediaPlaylist(MEDIA, (s) => s, "/api/video/key/NEW");
    expect(out).toContain('#EXT-X-KEY:METHOD=AES-128,URI="/api/video/key/NEW",IV=0xabc');
    expect(out).not.toContain("/api/video/key/lesson1");
  });

  it("сохраняет EXTINF и ENDLIST", () => {
    const out = rewriteMediaPlaylist(MEDIA, (s) => `X/${s}`, "K");
    expect(out).toContain("#EXTINF:6.000000,");
    expect(out).toContain("#EXT-X-ENDLIST");
  });
});

describe("parseSegmentKey", () => {
  it("разбирает корректный ключ сегмента", () => {
    expect(
      parseSegmentKey("courses/sales-pharma/lessons/abc/720p/seg_0001.ts"),
    ).toEqual({ variant: "720p", segment: "seg_0001.ts" });
  });

  it("480p тоже", () => {
    expect(
      parseSegmentKey("courses/x/lessons/y/480p/seg_0099.ts"),
    ).toEqual({ variant: "480p", segment: "seg_0099.ts" });
  });

  it("не-сегментный ключ → null", () => {
    expect(parseSegmentKey("courses/x/lessons/y/master.m3u8")).toBeNull();
    expect(parseSegmentKey("courses/x/lessons/y/720p/playlist.m3u8")).toBeNull();
  });
});
