import { describe, expect, it } from "vitest";
import { decodeServiceRef, filterSubChannels } from "./subchannel";
import type { Channel } from "./types";

/** テスト用チャンネルを最小構成で生成する */
function ch(
  id: string,
  group: string,
  name?: string,
  tvgId?: string
): Channel {
  return {
    id,
    name: name ?? id,
    group,
    url: `http://localhost/${id}`,
    kind: "mirakurun-mpegts",
    tvgId,
  };
}

/* ------------------------------------------------------------------ */
/*  decodeServiceRef                                                  */
/* ------------------------------------------------------------------ */

describe("decodeServiceRef", () => {
  it("3273601024 → networkId=32736, serviceId=1024", () => {
    const c = ch("3273601024", "GR");
    expect(decodeServiceRef(c)).toEqual({ networkId: 32736, serviceId: 1024 });
  });

  it("400101 → networkId=4, serviceId=101", () => {
    const c = ch("400101", "BS");
    expect(decodeServiceRef(c)).toEqual({ networkId: 4, serviceId: 101 });
  });

  it("tvgId が設定されていればそちらを優先する", () => {
    const c = ch("non-numeric", "GR", "test", "3273601024");
    expect(decodeServiceRef(c)).toEqual({ networkId: 32736, serviceId: 1024 });
  });

  it("非数値 ID → null", () => {
    expect(decodeServiceRef(ch("abc", "GR"))).toBeNull();
    expect(decodeServiceRef(ch("12.34", "GR"))).toBeNull();
    expect(decodeServiceRef(ch("", "GR"))).toBeNull();
  });

  it("100000 未満 → null", () => {
    expect(decodeServiceRef(ch("99999", "GR"))).toBeNull();
    expect(decodeServiceRef(ch("0", "GR"))).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  filterSubChannels                                                 */
/* ------------------------------------------------------------------ */

describe("filterSubChannels", () => {
  it("同一 networkId の GR: serviceId 最小 (メイン) だけ残す", () => {
    const channels = [
      ch("3273601024", "GR", "NHK総合1"),
      ch("3273601025", "GR", "NHK総合2"),
    ];
    const result = filterSubChannels(channels);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3273601024");
  });

  it("異なる networkId の GR は互いに干渉しない", () => {
    const channels = [
      ch("3273601024", "GR", "NHK総合1"),
      ch("3273601025", "GR", "NHK総合2"),
      ch("3273701032", "GR", "NHK Eテレ1"),
      ch("3273701033", "GR", "NHK Eテレ2"),
    ];
    const result = filterSubChannels(channels);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toEqual(["3273601024", "3273701032"]);
  });

  it("BS チャンネルはフィルタ対象外 (全て残る)", () => {
    const channels = [
      ch("400101", "BS", "BS1"),
      ch("400102", "BS", "BS2"),
    ];
    const result = filterSubChannels(channels);
    expect(result).toHaveLength(2);
  });

  it("CS チャンネルもフィルタ対象外", () => {
    const channels = [
      ch("700101", "CS", "CS1"),
      ch("700102", "CS", "CS2"),
    ];
    const result = filterSubChannels(channels);
    expect(result).toHaveLength(2);
  });

  it("非数値 ID の GR チャンネルは残す (隠しすぎない)", () => {
    const channels = [
      ch("nhk-g", "GR", "NHK総合"),
      ch("3273601024", "GR", "NHK総合1"),
      ch("3273601025", "GR", "NHK総合2"),
    ];
    const result = filterSubChannels(channels);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toEqual(["nhk-g", "3273601024"]);
  });

  it("元の並び順を保持する", () => {
    const channels = [
      ch("400101", "BS", "BS1"),
      ch("3273601025", "GR", "NHK総合2"),
      ch("3273601024", "GR", "NHK総合1"),
      ch("700101", "CS", "CS1"),
    ];
    const result = filterSubChannels(channels);
    // NHK総合2 が除外され、残りは元の順序
    expect(result.map((c) => c.id)).toEqual([
      "400101",
      "3273601024",
      "700101",
    ]);
  });

  it("空配列 → 空配列", () => {
    expect(filterSubChannels([])).toEqual([]);
  });
});
