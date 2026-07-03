import { describe, expect, it } from "vitest";
import { adjacentChannelId, visibleChannels } from "./channelNav";
import type { Channel } from "./types";

function ch(id: string, group: string, name?: string): Channel {
  return {
    id,
    name: name ?? id,
    group,
    url: `http://localhost/${id}`,
    kind: "mirakurun-mpegts",
  };
}

/* ------------------------------------------------------------------ */
/*  visibleChannels                                                   */
/* ------------------------------------------------------------------ */

describe("visibleChannels", () => {
  const channels: Channel[] = [
    ch("3273601024", "GR", "NHK総合1"),
    ch("3273601025", "GR", "NHK総合2"),
    ch("400101", "BS", "BS1"),
    ch("400102", "BS", "BS2"),
  ];

  it("showSubChannels=false でサブチャンネルを除外する", () => {
    const result = visibleChannels(channels, "", false);
    expect(result.find((c) => c.id === "3273601025")).toBeUndefined();
    expect(result.find((c) => c.id === "3273601024")).toBeDefined();
  });

  it("showSubChannels=true で全チャンネルを表示する", () => {
    const result = visibleChannels(channels, "", true);
    expect(result).toHaveLength(4);
  });

  it("検索でフィルタされる", () => {
    const result = visibleChannels(channels, "BS1", true);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("400101");
  });

  it("グループ初出順が保持される (GR → BS)", () => {
    const result = visibleChannels(channels, "", true);
    const grIdx = result.findIndex((c) => c.group === "GR");
    const bsIdx = result.findIndex((c) => c.group === "BS");
    expect(grIdx).toBeLessThan(bsIdx);
  });

  it("空配列 → 空配列", () => {
    expect(visibleChannels([], "", false)).toEqual([]);
  });

  it("検索+サブチャンネル除外の組合せ", () => {
    const result = visibleChannels(channels, "NHK", false);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3273601024");
  });
});

/* ------------------------------------------------------------------ */
/*  adjacentChannelId                                                 */
/* ------------------------------------------------------------------ */

describe("adjacentChannelId", () => {
  const list = [ch("a", "GR"), ch("b", "GR"), ch("c", "BS")];

  it("+1 で次のチャンネルに進む", () => {
    expect(adjacentChannelId(list, "a", 1)).toBe("b");
    expect(adjacentChannelId(list, "b", 1)).toBe("c");
  });

  it("-1 で前のチャンネルに戻る", () => {
    expect(adjacentChannelId(list, "c", -1)).toBe("b");
    expect(adjacentChannelId(list, "b", -1)).toBe("a");
  });

  it("末端で留まる (+1)", () => {
    expect(adjacentChannelId(list, "c", 1)).toBe("c");
  });

  it("先端で留まる (-1)", () => {
    expect(adjacentChannelId(list, "a", -1)).toBe("a");
  });

  it("空リスト → null", () => {
    expect(adjacentChannelId([], "a", 1)).toBeNull();
  });

  it("currentId が null → 先頭", () => {
    expect(adjacentChannelId(list, null, 1)).toBe("a");
  });

  it("currentId がリスト外 → 先頭", () => {
    expect(adjacentChannelId(list, "unknown", 1)).toBe("a");
  });
});
