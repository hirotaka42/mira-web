import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  epgstationOrigin,
  fetchM2tsModes,
  parseM2tsModes,
} from "./epgstationConfig";
import type { Channel } from "./types";

function ch(
  url: string,
  kind: "mirakurun-mpegts" | "epgstation-hls"
): Channel {
  return { id: "t", name: "T", group: "GR", url, kind };
}

/* ------------------------------------------------------------------ */
/*  parseM2tsModes                                                    */
/* ------------------------------------------------------------------ */

describe("parseM2tsModes", () => {
  it("実データ形の JSON を正しくパースする", () => {
    const json = {
      streamConfig: {
        live: {
          ts: {
            m2ts: [
              { name: "480p (VAAPI)", isUnconverted: false },
              { name: "無変換", isUnconverted: true },
            ],
          },
        },
      },
    };
    const result = parseM2tsModes(json);
    expect(result).toEqual([
      { name: "480p (VAAPI)", isUnconverted: false },
      { name: "無変換", isUnconverted: true },
    ]);
  });

  it("streamConfig 欠落 → null", () => {
    expect(parseM2tsModes({})).toBeNull();
  });

  it("m2ts が空配列 → null", () => {
    expect(
      parseM2tsModes({
        streamConfig: { live: { ts: { m2ts: [] } } },
      })
    ).toBeNull();
  });

  it("name が無いオブジェクト → null", () => {
    expect(
      parseM2tsModes({
        streamConfig: {
          live: { ts: { m2ts: [{ isUnconverted: true }] } },
        },
      })
    ).toBeNull();
  });

  it("null 入力 → null", () => {
    expect(parseM2tsModes(null)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  epgstationOrigin                                                  */
/* ------------------------------------------------------------------ */

describe("epgstationOrigin", () => {
  it("epgstation-hls チャンネルの origin を返す", () => {
    const channels = [
      ch("http://192.168.1.10:40772/api/services/1/stream", "mirakurun-mpegts"),
      ch("https://epg.example.com/api/streams/live/6528/hls?mode=0", "epgstation-hls"),
    ];
    expect(epgstationOrigin(channels)).toBe("https://epg.example.com");
  });

  it("mirakurun のみ → null", () => {
    const channels = [
      ch("http://192.168.1.10:40772/api/services/1/stream", "mirakurun-mpegts"),
    ];
    expect(epgstationOrigin(channels)).toBeNull();
  });

  it("空配列 → null", () => {
    expect(epgstationOrigin([])).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  fetchM2tsModes                                                    */
/* ------------------------------------------------------------------ */

describe("fetchM2tsModes", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("成功時にパース結果を返す", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          streamConfig: {
            live: {
              ts: {
                m2ts: [{ name: "720p", isUnconverted: false }],
              },
            },
          },
        }),
    }) as unknown as typeof fetch;

    const result = await fetchM2tsModes("http://localhost:8888");
    expect(result).toEqual([{ name: "720p", isUnconverted: false }]);
  });

  it("HTTP エラー → null", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as unknown as typeof fetch;

    expect(await fetchM2tsModes("http://localhost:8888")).toBeNull();
  });

  it("JSON 不正 → null", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ other: "data" }),
    }) as unknown as typeof fetch;

    expect(await fetchM2tsModes("http://localhost:8888")).toBeNull();
  });
});
