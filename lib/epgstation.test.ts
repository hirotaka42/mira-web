import { describe, expect, it } from "vitest";
import {
  buildHlsM3u,
  isEpgstationChannelsUrl,
  looksLikeEpgstationChannels,
  type EpgstationChannel,
} from "./epgstation";
import { parseM3u } from "./m3u";

describe("isEpgstationChannelsUrl", () => {
  it("/api/channels (and trailing slash) は true", () => {
    expect(isEpgstationChannelsUrl(new URL("https://e/api/channels"))).toBe(true);
    expect(isEpgstationChannelsUrl(new URL("https://e/api/channels/"))).toBe(true);
  });

  it("子パスは false", () => {
    expect(
      isEpgstationChannelsUrl(new URL("https://e/api/channels/3273601024/logo"))
    ).toBe(false);
  });

  it("関係ない API は false", () => {
    expect(isEpgstationChannelsUrl(new URL("https://e/api/version"))).toBe(false);
    expect(
      isEpgstationChannelsUrl(new URL("https://e/api/iptv/channel.m3u8"))
    ).toBe(false);
  });
});

describe("buildHlsM3u", () => {
  const sampleChannels: EpgstationChannel[] = [
    {
      id: 400211,
      serviceId: 211,
      networkId: 4,
      name: "ＢＳ１１イレブン",
      channelType: "BS",
      channel: "BS-211",
      hasLogoData: true,
    },
    {
      id: 3273601024,
      serviceId: 1024,
      networkId: 32736,
      name: "ＮＨＫ総合１・東京",
      channelType: "GR",
      channel: "27",
      hasLogoData: true,
    },
    {
      id: 700161,
      name: "ＱＶＣ",
      channelType: "CS",
      channel: "CS-161",
      hasLogoData: false,
    },
  ];
  const baseUrl = new URL("https://epg.example.com/api/channels");

  it("生成された m3u は parseM3u で解釈でき epgstation-hls 種別になる", () => {
    const m3u = buildHlsM3u(sampleChannels, baseUrl, 0);
    const channels = parseM3u(m3u);
    expect(channels).toHaveLength(3);
    expect(channels.every((c) => c.kind === "epgstation-hls")).toBe(true);
  });

  it("各 URL は HLS 起動 RPC を指す", () => {
    const m3u = buildHlsM3u(sampleChannels, baseUrl, 0);
    const channels = parseM3u(m3u);
    expect(channels[0].url).toMatch(/\/api\/streams\/live\/\d+\/hls\?mode=0$/);
    expect(channels[0].url).toContain("https://epg.example.com");
  });

  it("GR/BS/CS の順で並び、同 channelType 内は channel/serviceId 昇順", () => {
    const m3u = buildHlsM3u(sampleChannels, baseUrl);
    const channels = parseM3u(m3u);
    expect(channels[0].group).toBe("GR");
    expect(channels[1].group).toBe("BS");
    expect(channels[2].group).toBe("CS");
  });

  it("hasLogoData=true のときだけ tvg-logo を出す", () => {
    const m3u = buildHlsM3u(sampleChannels, baseUrl);
    expect(m3u).toContain('tvg-logo="https://epg.example.com/api/channels/400211/logo"');
    expect(m3u).not.toContain('tvg-logo=""');
    // QVC (hasLogoData=false) には logo URL が無い
    const qvcLine = m3u.split("\n").find((l) => l.includes("ＱＶＣ"));
    expect(qvcLine).toBeDefined();
    expect(qvcLine!).not.toContain("tvg-logo");
  });

  it("mode を指定すると URL の mode= が反映される", () => {
    const m3u = buildHlsM3u(sampleChannels, baseUrl, 2);
    const channels = parseM3u(m3u);
    expect(channels.every((c) => /mode=2$/.test(c.url))).toBe(true);
  });

  it("name が無い場合は halfWidthName / フォールバック", () => {
    const ch: EpgstationChannel[] = [
      { id: 1, halfWidthName: "Half", channelType: "GR", hasLogoData: false },
      { id: 2, channelType: "GR", hasLogoData: false },
    ];
    const m3u = buildHlsM3u(ch, baseUrl);
    expect(m3u).toContain(",Half\n");
    expect(m3u).toContain(",ch-2\n");
  });
});

describe("looksLikeEpgstationChannels", () => {
  it("EPGStation の channels JSON は true", () => {
    const sample = [
      { id: 400211, name: "ＢＳ１１", channelType: "BS", channel: "BS-211" },
    ];
    expect(looksLikeEpgstationChannels(sample)).toBe(true);
  });

  it("空配列は false", () => {
    expect(looksLikeEpgstationChannels([])).toBe(false);
  });

  it("プリミティブ配列は false", () => {
    expect(looksLikeEpgstationChannels([1, 2, 3])).toBe(false);
    expect(looksLikeEpgstationChannels(["a", "b"])).toBe(false);
  });

  it("id が string なら false", () => {
    expect(looksLikeEpgstationChannels([{ id: "x", name: "A" }])).toBe(false);
  });

  it("name/halfWidthName/channel が無いなら false", () => {
    expect(looksLikeEpgstationChannels([{ id: 1 }])).toBe(false);
  });

  it("halfWidthName のみでも true (一部 EPGStation バージョンで起こる)", () => {
    expect(
      looksLikeEpgstationChannels([{ id: 1, halfWidthName: "X" }])
    ).toBe(true);
  });

  it("null/undefined 要素は false", () => {
    expect(looksLikeEpgstationChannels([null])).toBe(false);
    expect(looksLikeEpgstationChannels([undefined])).toBe(false);
  });
});
