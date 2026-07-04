import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

// GitHub Pages のサブパス対応:
//   ユーザーサイト (https://<user>.github.io/) では空文字
//   プロジェクトサイト (https://<user>.github.io/mira-web/) では "/mira-web"
// CI で NEXT_PUBLIC_BASE_PATH を渡す。手元の dev では空でOK。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// バージョン情報(ビルド時に確定してクライアントへ注入する)。
const appVersion = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
).version as string;
const buildDate = new Date().toISOString().slice(0, 10);
const gitSha = (() => {
  // CI では GITHUB_SHA、手元では git から取得。取れなければ空。
  const envSha = process.env.GITHUB_SHA;
  if (envSha) return envSha.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "";
  }
})();

const nextConfig: NextConfig = {
  // 静的書き出し → out/ に HTML/JS/CSS/WASM を吐く。サーバ機能は使えない。
  output: "export",

  // GitHub Pages は /foo/ → /foo/index.html を返すので trailing slash 推奨
  trailingSlash: true,

  // GitHub Pages は画像最適化サーバを持てない
  images: { unoptimized: true },

  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,

  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_BUILD_DATE: buildDate,
    NEXT_PUBLIC_GIT_SHA: gitSha,
  },

  // 静的書き出しでは next.config の headers() は無視される。
  // SharedArrayBuffer に必要な COOP/COEP は public/coi-serviceworker.js で
  // クライアント側 Service Worker から付与する。

  // ts-live.js 初期化が二重実行されると重いため StrictMode は無効
  reactStrictMode: false,
};

export default nextConfig;
