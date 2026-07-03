import { describe, expect, it } from "vitest";
import { describePlayerError } from "./playerError";

describe("describePlayerError", () => {
  it("Failed to fetch → 接続エラー", () => {
    expect(describePlayerError("Failed to fetch")).toContain("接続できませんでした");
  });

  it("CORS → 接続エラー", () => {
    expect(describePlayerError("CORS error occurred")).toContain("CORS");
  });

  it("タイムアウト → タイムアウト", () => {
    expect(describePlayerError("HLS ストリームの起動がタイムアウトしました")).toContain(
      "タイムアウト"
    );
  });

  it("WebGPU → 非対応", () => {
    expect(describePlayerError("WebGPU に対応していません")).toContain("対応していません");
  });

  it("WebCodecs → 非対応", () => {
    expect(describePlayerError("WebCodecs に対応していません")).toContain("対応していません");
  });

  it("SharedArrayBuffer → 非対応", () => {
    expect(describePlayerError("SharedArrayBuffer が利用できません")).toContain(
      "対応していません"
    );
  });

  it("iOS / iPadOS → 非対応", () => {
    expect(describePlayerError("iOS / iPadOS 上では現状ご利用いただけません")).toContain(
      "対応していません"
    );
  });

  it("mixed content → HTTPS/HTTP 不一致", () => {
    expect(
      describePlayerError("現在のページは HTTPS ですが、指定された URL は HTTP です")
    ).toContain("HTTPS");
  });

  it("該当なし → 汎用メッセージ", () => {
    expect(describePlayerError("不明なエラー")).toBe("再生を開始できませんでした");
  });

  it("先勝ち: Failed to fetch + https → 接続エラー", () => {
    const msg = "Failed to fetch — https サーバに接続できません";
    expect(describePlayerError(msg)).toContain("接続できませんでした");
  });
});
