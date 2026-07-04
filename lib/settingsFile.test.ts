import { describe, expect, it } from "vitest";
import { exportSettings, parseSettingsFile } from "./settingsFile";

describe("exportSettings / parseSettingsFile round-trip", () => {
  it("export → parse で一致する", () => {
    const json = exportSettings({
      source: { kind: "url", value: "https://example.com/api/iptv/playlist" },
      showSubChannels: true,
      externalPlayer: "vlc",
      externalM2tsMode: 2,
      now: "2026-07-04T00:00:00.000Z",
    });
    const parsed = parseSettingsFile(json);
    expect(parsed).not.toBeNull();
    expect(parsed!.format).toBe("mira-web-settings");
    expect(parsed!.version).toBe(1);
    expect(parsed!.source.kind).toBe("url");
    expect(parsed!.source.value).toBe("https://example.com/api/iptv/playlist");
    expect(parsed!.settings.showSubChannels).toBe(true);
    expect(parsed!.settings.externalPlayer).toBe("vlc");
    expect(parsed!.settings.externalM2tsMode).toBe(2);
  });

  it("source が null の場合も export できる", () => {
    const json = exportSettings({
      source: null,
      showSubChannels: false,
      externalPlayer: "infuse",
      externalM2tsMode: 0,
      now: "2026-07-04T00:00:00.000Z",
    });
    const parsed = parseSettingsFile(json);
    expect(parsed).not.toBeNull();
    expect(parsed!.source.value).toBe("");
  });
});

describe("parseSettingsFile — 誤認防止", () => {
  it("EPGStation JSON 配列 ([ 始まり) は null", () => {
    const epg = JSON.stringify([
      { id: 1, name: "NHK", channelType: "GR" },
    ]);
    expect(parseSettingsFile(epg)).toBeNull();
  });

  it("生 m3u は null", () => {
    const m3u = "#EXTM3U\n#EXTINF:-1,Test\nhttp://example.com\n";
    expect(parseSettingsFile(m3u)).toBeNull();
  });

  it("format が違う JSON は null", () => {
    expect(parseSettingsFile('{"format":"other","version":1}')).toBeNull();
  });

  it("不正な JSON は null", () => {
    expect(parseSettingsFile("{broken")).toBeNull();
  });
});

describe("parseSettingsFile — バージョンチェック", () => {
  it("version 2 は throw", () => {
    const v2 = JSON.stringify({
      format: "mira-web-settings",
      version: 2,
      source: { kind: "url", value: "" },
      settings: {},
    });
    expect(() => parseSettingsFile(v2)).toThrow("新しいバージョン");
  });
});

describe("parseSettingsFile — settings 部分適用", () => {
  it("settings の一部キーだけでも parse できる", () => {
    const partial = JSON.stringify({
      format: "mira-web-settings",
      version: 1,
      exportedAt: "2026-07-04T00:00:00.000Z",
      source: { kind: "text", value: "#EXTM3U\n" },
      settings: { showSubChannels: true },
    });
    const parsed = parseSettingsFile(partial);
    expect(parsed).not.toBeNull();
    expect(parsed!.settings.showSubChannels).toBe(true);
    expect(parsed!.settings.externalPlayer).toBeUndefined();
  });
});
