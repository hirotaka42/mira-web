import type { NextConfig } from "next";

// GitHub Pages のサブパス対応:
//   ユーザーサイト (https://<user>.github.io/) では空文字
//   プロジェクトサイト (https://<user>.github.io/mira-web/) では "/mira-web"
// CI で NEXT_PUBLIC_BASE_PATH を渡す。手元の dev では空でOK。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // 静的書き出し → out/ に HTML/JS/CSS/WASM を吐く。サーバ機能は使えない。
  output: "export",

  // GitHub Pages は /foo/ → /foo/index.html を返すので trailing slash 推奨
  trailingSlash: true,

  // GitHub Pages は画像最適化サーバを持てない
  images: { unoptimized: true },

  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,

  // 静的書き出しでは next.config の headers() は無視される。
  // SharedArrayBuffer に必要な COOP/COEP は public/coi-serviceworker.js で
  // クライアント側 Service Worker から付与する。

  // ts-live.js 初期化が二重実行されると重いため StrictMode は無効
  reactStrictMode: false,
};

export default nextConfig;
