import { describe, expect, it } from "vitest";
import {
  buildExternalPlayerUrl,
  detectPlatformFrom,
  externalStreamUrl,
} from "./externalPlayer";
import type { Channel } from "./types";

function ch(
  url: string,
  kind: "mirakurun-mpegts" | "epgstation-hls"
): Channel {
  return {
    id: "test",
    name: "Test",
    group: "GR",
    url,
    kind,
  };
}

/* ------------------------------------------------------------------ */
/*  detectPlatformFrom                                                */
/* ------------------------------------------------------------------ */

describe("detectPlatformFrom", () => {
  it("iPhone UA → ios", () => {
    expect(
      detectPlatformFrom(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        5
      )
    ).toBe("ios");
  });

  it("iPad UA → ios", () => {
    expect(
      detectPlatformFrom(
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)",
        5
      )
    ).toBe("ios");
  });

  it("Macintosh + maxTouchPoints=5 (iPadOS 13+) → ios", () => {
    expect(
      detectPlatformFrom(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        5
      )
    ).toBe("ios");
  });

  it("Macintosh + maxTouchPoints=0 (通常 Mac) → other", () => {
    expect(
      detectPlatformFrom(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        0
      )
    ).toBe("other");
  });

  it("Android UA → android", () => {
    expect(
      detectPlatformFrom(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36",
        5
      )
    ).toBe("android");
  });

  it("Windows UA → other", () => {
    expect(
      detectPlatformFrom(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        0
      )
    ).toBe("other");
  });
});

/* ------------------------------------------------------------------ */
/*  externalStreamUrl                                                 */
/* ------------------------------------------------------------------ */

describe("externalStreamUrl", () => {
  it("mirakurun チャンネルはそのまま URL を返す", () => {
    const c = ch("http://192.168.1.10:40772/api/services/3273601024/stream", "mirakurun-mpegts");
    expect(externalStreamUrl(c, 0)).toBe(c.url);
  });

  it("EPGStation HLS → m2ts URL に変換 (mode 指定)", () => {
    const c = ch("https://host/api/streams/live/6528/hls?mode=0", "epgstation-hls");
    expect(externalStreamUrl(c, 2)).toBe(
      "https://host/api/streams/live/6528/m2ts?mode=2"
    );
  });

  it("EPGStation HLS で pathname が非該当なら null", () => {
    const c = ch("https://host/api/other/path", "epgstation-hls");
    expect(externalStreamUrl(c, 0)).toBeNull();
  });

  it("不正 URL → null", () => {
    const c = ch("not-a-url", "epgstation-hls");
    expect(externalStreamUrl(c, 0)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  buildExternalPlayerUrl                                            */
/* ------------------------------------------------------------------ */

describe("buildExternalPlayerUrl", () => {
  const stream = "http://192.168.1.10:40772/api/services/3273601024/stream";

  it("ios × infuse", () => {
    const result = buildExternalPlayerUrl(stream, "infuse", "ios");
    expect(result).toBe(
      `infuse://x-callback-url/play?url=${encodeURIComponent(stream)}`
    );
  });

  it("ios × vlc", () => {
    const result = buildExternalPlayerUrl(stream, "vlc", "ios");
    expect(result).toBe(
      `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(stream)}`
    );
  });

  it("android → VLC intent (query 付き URL の search 保持)", () => {
    const streamWithQuery =
      "https://host/api/streams/live/6528/m2ts?mode=2";
    const result = buildExternalPlayerUrl(
      streamWithQuery,
      "vlc",
      "android"
    );
    expect(result).toContain("intent://host/api/streams/live/6528/m2ts?mode=2");
    expect(result).toContain("scheme=https");
    expect(result).toContain("package=org.videolan.vlc");
    expect(result).toMatch(/;end$/);
  });

  it("other → null", () => {
    expect(buildExternalPlayerUrl(stream, "infuse", "other")).toBeNull();
  });
});
