import { describe, expect, it } from "vitest";
import { groupChannels, parseM3u } from "./m3u";

const MIRAKURUN_SAMPLE = `# Mirakurun IPTV プレイリスト
#EXTM3U url-tvg="http://example.com:40772/api/iptv/xmltv"
#KODIPROP:mimetype=video/mp2t
#EXTINF:-1 tvg-id="3273601024" group-title="GR",ＮＨＫ総合１・東京
http://example.com:40772/api/services/3273601024/stream
#KODIPROP:mimetype=video/mp2t
#EXTINF:-1 tvg-id="400101" tvg-logo="http://example.com/logo.png" group-title="BS",ＮＨＫ ＢＳ
http://example.com:40772/api/services/400101/stream
`;

describe("parseM3u", () => {
  it("Mirakurun 互換 m3u を正しくパースする", () => {
    const channels = parseM3u(MIRAKURUN_SAMPLE);
    expect(channels).toHaveLength(2);

    expect(channels[0]).toEqual({
      id: "3273601024",
      name: "ＮＨＫ総合１・東京",
      group: "GR",
      url: "http://example.com:40772/api/services/3273601024/stream",
      tvgId: "3273601024",
      logo: undefined,
    });

    expect(channels[1]).toEqual({
      id: "400101",
      name: "ＮＨＫ ＢＳ",
      group: "BS",
      url: "http://example.com:40772/api/services/400101/stream",
      tvgId: "400101",
      logo: "http://example.com/logo.png",
    });
  });

  it("空の入力で空配列を返す", () => {
    expect(parseM3u("")).toEqual([]);
    expect(parseM3u("#EXTM3U\n")).toEqual([]);
  });

  it("コメント / 空行 / KODIPROP を無視する", () => {
    const text = `
#EXTM3U
# 普通のコメント

#KODIPROP:foo=bar
#EXTINF:-1 tvg-id="1" group-title="GR",CH1
http://x/1
`;
    expect(parseM3u(text)).toHaveLength(1);
  });

  it("group-title が無いチャンネルは OTHER にフォールバック", () => {
    const text = `#EXTM3U
#EXTINF:-1 tvg-id="9",NoGroup
http://x/9
`;
    expect(parseM3u(text)[0].group).toBe("OTHER");
  });

  it("tvg-id が無い場合は URL から数値 ID を抽出する", () => {
    const text = `#EXTM3U
#EXTINF:-1 group-title="GR",NoTvgId
http://x/api/services/12345/stream
`;
    expect(parseM3u(text)[0].id).toBe("12345");
  });

  it("EXTINF と URL の対応が崩れていても他の正常エントリは取れる", () => {
    const text = `#EXTM3U
#EXTINF:-1 tvg-id="1" group-title="GR",CH1
http://x/1
#EXTINF:-1 tvg-id="2" group-title="GR",CH2
# 次の URL が無い
#EXTINF:-1 tvg-id="3" group-title="GR",CH3
http://x/3
`;
    const channels = parseM3u(text);
    // 2 番目は URL が無いまま 3 番目の EXTINF に上書きされる
    expect(channels.map((c) => c.id)).toContain("1");
    expect(channels.map((c) => c.id)).toContain("3");
  });

  it("CRLF 改行も扱える", () => {
    const text = "#EXTM3U\r\n#EXTINF:-1 tvg-id=\"1\" group-title=\"GR\",CH1\r\nhttp://x/1\r\n";
    expect(parseM3u(text)).toHaveLength(1);
  });
});

describe("parseM3u (URL rewriting with baseUrl)", () => {
  const text = `#EXTM3U
#EXTINF:-1 tvg-id="1" group-title="GR",CH1
http://example.com:40772/api/services/1/stream
#EXTINF:-1 tvg-id="2" group-title="GR",CH2
http://other.cdn.com/services/2/stream
`;

  it("baseUrl が無いときは何もしない (後方互換)", () => {
    const ch = parseM3u(text);
    expect(ch[0].url).toBe("http://example.com:40772/api/services/1/stream");
    expect(ch[1].url).toBe("http://other.cdn.com/services/2/stream");
  });

  it("baseUrl が https で同一ホストなら scheme と host(port含) を揃える", () => {
    const ch = parseM3u(text, "https://example.com/api/iptv/playlist");
    expect(ch[0].url).toBe("https://example.com/api/services/1/stream");
    // 別ホストには触らない
    expect(ch[1].url).toBe("http://other.cdn.com/services/2/stream");
  });

  it("baseUrl が同一ホスト・同一 scheme なら実質変化なし", () => {
    const ch = parseM3u(text, "http://example.com:40772/api/iptv/playlist");
    expect(ch[0].url).toBe("http://example.com:40772/api/services/1/stream");
  });

  it("不正な baseUrl は無視 (リライトしない)", () => {
    const ch = parseM3u(text, "not a url");
    expect(ch[0].url).toBe("http://example.com:40772/api/services/1/stream");
  });

  it("URL オブジェクトでも文字列でも受け付ける", () => {
    const ch1 = parseM3u(text, new URL("https://example.com/api/iptv/playlist"));
    const ch2 = parseM3u(text, "https://example.com/api/iptv/playlist");
    expect(ch1[0].url).toBe(ch2[0].url);
  });

  it("Mirakurun 越し Tailscale Serve の実シナリオ (port 違い)", () => {
    // 取得 URL は https の 443 (port なし)、m3u 内 URL は :40772 が直リン → リライト後は port 揃う
    const realText = `#EXTM3U
#EXTINF:-1 tvg-id="3273601024" group-title="GR",NHK
http://mirakurun-zimablade01.tail411f6c.ts.net/api/services/3273601024/stream
`;
    const ch = parseM3u(
      realText,
      "https://mirakurun-zimablade01.tail411f6c.ts.net/api/iptv/playlist"
    );
    expect(ch[0].url).toBe(
      "https://mirakurun-zimablade01.tail411f6c.ts.net/api/services/3273601024/stream"
    );
  });
});

describe("groupChannels", () => {
  it("group ごとに分類する", () => {
    const channels = parseM3u(MIRAKURUN_SAMPLE);
    const grouped = groupChannels(channels);
    expect(grouped.get("GR")).toHaveLength(1);
    expect(grouped.get("BS")).toHaveLength(1);
  });

  it("空配列でも空 Map を返す", () => {
    const grouped = groupChannels([]);
    expect(grouped.size).toBe(0);
  });
});
