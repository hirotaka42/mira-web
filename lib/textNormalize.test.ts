import { describe, expect, it } from "vitest";
import {
  toHalfWidth,
  foldForSearch,
  romajiToHiragana,
  channelMatchesSearch,
} from "./textNormalize";

/* ------------------------------------------------------------------ */
/*  toHalfWidth (表示用)                                               */
/* ------------------------------------------------------------------ */

describe("toHalfWidth", () => {
  it("全角英字を半角化する", () => {
    expect(toHalfWidth("ＮＨＫ")).toBe("NHK");
    expect(toHalfWidth("ＴＢＳ")).toBe("TBS");
    expect(toHalfWidth("ＷＯＷＯＷプライム")).toBe("WOWOWプライム");
  });

  it("全角数字を半角化する", () => {
    expect(toHalfWidth("ＮＨＫ総合１・東京")).toBe("NHK総合1・東京");
    expect(toHalfWidth("ＢＳ１１イレブン")).toBe("BS11イレブン");
  });

  it("全角スペースを半角スペースにする", () => {
    expect(toHalfWidth("ＴＯＫＹＯ　ＭＸ１")).toBe("TOKYO MX1");
  });

  it("カタカナ・漢字・中黒はそのまま保持する", () => {
    expect(toHalfWidth("ＢＳアニマックス")).toBe("BSアニマックス");
    expect(toHalfWidth("日テレ１")).toBe("日テレ1");
    expect(toHalfWidth("カートゥーン")).toBe("カートゥーン");
  });

  it("既に半角の文字列は不変(冪等)", () => {
    expect(toHalfWidth("NHK総合1")).toBe("NHK総合1");
    expect(toHalfWidth(toHalfWidth("ＮＨＫ総合１"))).toBe("NHK総合1");
  });
});

/* ------------------------------------------------------------------ */
/*  foldForSearch (検索キー)                                           */
/* ------------------------------------------------------------------ */

describe("foldForSearch", () => {
  it("全角/半角・大小を吸収して同じキーにする", () => {
    expect(foldForSearch("ＮＨＫ")).toBe(foldForSearch("nhk"));
    expect(foldForSearch("NHK")).toBe("nhk");
  });

  it("カタカナとひらがなを同一視する", () => {
    expect(foldForSearch("アニ")).toBe("あに");
    expect(foldForSearch("アニ")).toBe(foldForSearch("あに"));
  });

  it("半角カナも全角カナ経由でひらがなに畳む", () => {
    expect(foldForSearch("ｱﾆ")).toBe("あに");
  });
});

/* ------------------------------------------------------------------ */
/*  romajiToHiragana                                                   */
/* ------------------------------------------------------------------ */

describe("romajiToHiragana", () => {
  it("基本の五十音", () => {
    expect(romajiToHiragana("ani")).toBe("あに");
    expect(romajiToHiragana("dorama")).toBe("どらま");
    expect(romajiToHiragana("terebi")).toBe("てれび");
  });

  it("拗音・外来音", () => {
    expect(romajiToHiragana("nyu")).toBe("にゅ");
    expect(romajiToHiragana("cha")).toBe("ちゃ");
    expect(romajiToHiragana("myu")).toBe("みゅ");
    expect(romajiToHiragana("di")).toBe("でぃ");
  });

  it("撥音 n → ん", () => {
    expect(romajiToHiragana("chan")).toBe("ちゃん");
    expect(romajiToHiragana("nihon")).toBe("にほん");
  });

  it("促音(子音重ね)→ っ", () => {
    expect(romajiToHiragana("kizzu")).toBe("きっず");
  });

  it("末尾の未確定子音は落とす(逐次入力向け)", () => {
    // "anim" は あに+落とした m → あに(アニメに前方一致できる)
    expect(romajiToHiragana("anim")).toBe("あに");
  });
});

/* ------------------------------------------------------------------ */
/*  channelMatchesSearch — 実チャンネル名を模した統合ケース             */
/* ------------------------------------------------------------------ */

describe("channelMatchesSearch", () => {
  // 表示名は toHalfWidth 適用後(= 実際に Sidebar が持つ name)を想定
  it("ASCII 小文字クエリが半角化済みの英字名に当たる", () => {
    expect(channelMatchesSearch("NHK総合1・東京", "nhk")).toBe(true);
    expect(channelMatchesSearch("TBS1", "tbs")).toBe(true);
    expect(channelMatchesSearch("TOKYO MX1", "mx")).toBe(true);
  });

  it("ひらがなクエリがカタカナ名に当たる(あに→アニ)", () => {
    expect(channelMatchesSearch("BSアニマックス", "あに")).toBe(true);
  });

  it("カタカナクエリがカタカナ名に当たる", () => {
    expect(channelMatchesSearch("BSアニマックス", "アニ")).toBe(true);
  });

  it("ローマ字クエリがカタカナ名に当たる(ani→アニ)", () => {
    expect(channelMatchesSearch("BSアニマックス", "ani")).toBe(true);
    expect(channelMatchesSearch("ディスカバリー", "disuka")).toBe(true);
    expect(channelMatchesSearch("ホームドラマCH", "dorama")).toBe(true);
  });

  it("全角クエリ(IME)も半角名に当たる", () => {
    expect(channelMatchesSearch("NHK総合1・東京", "ＮＨＫ")).toBe(true);
  });

  it("無関係なクエリは当たらない", () => {
    expect(channelMatchesSearch("BSアニマックス", "ゴルフ")).toBe(false);
    expect(channelMatchesSearch("NHK総合1・東京", "xyz")).toBe(false);
  });

  it("空クエリは常に真(フィルタ無し)", () => {
    expect(channelMatchesSearch("なんでも", "")).toBe(true);
    expect(channelMatchesSearch("なんでも", "   ")).toBe(true);
  });
});
