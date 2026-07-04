/**
 * アプリのバージョン情報。ビルド時に next.config.ts が env として注入する
 * (package.json の version・ビルド日・git コミット短縮 SHA)。
 * 未注入の環境(dev 等)ではプレースホルダにフォールバックする。
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
export const BUILD_DATE = process.env.NEXT_PUBLIC_BUILD_DATE ?? "";
export const GIT_SHA = process.env.NEXT_PUBLIC_GIT_SHA ?? "";

/** ヘッダ等に出す短い版表示。例: "v0.1.0" */
export const versionShort = `v${APP_VERSION}`;

/** 設定画面等に出す詳細表示。例: "v0.1.0 (a1b2c3d · 2026-07-04)" */
export const versionLong = (() => {
  const detail = [GIT_SHA, BUILD_DATE].filter(Boolean).join(" · ");
  return detail ? `v${APP_VERSION} (${detail})` : `v${APP_VERSION}`;
})();
