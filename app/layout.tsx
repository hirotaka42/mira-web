import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Mira WebUI",
  description:
    "Mira WebUI — a static, browser-only IPTV viewer for Mirakurun / EPGStation",
  applicationName: "Mira WebUI",
  // PWA: iOS Safari の "ホーム画面に追加" を全画面起動アプリとして扱わせる
  appleWebApp: {
    capable: true,
    title: "Mira",
    statusBarStyle: "black-translucent",
  },
  // 検索エンジンへのインデックスは任意 (private 利用想定なら disabled も可)
  formatDetection: {
    telephone: false,
  },
};

// Next.js 14+ では theme color / viewport は metadata から分離
export const viewport: Viewport = {
  themeColor: "#0891b2", // cyan-600 — iOS のステータスバー / Android のアプリバー
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // 全画面映像視聴のため横向きも自然にスケール
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/*
          iOS 16 未満は W3C 標準の `mobile-web-app-capable=yes` を解釈しないため、
          Apple 独自の deprecated タグも併記して下位互換を確保する。
          (Next.js metadata API は新しい標準しか出さないので手書き)
        */}
        <meta name="apple-mobile-web-app-capable" content="yes" />

        {/*
          SharedArrayBuffer に必要な Cross-Origin Isolation を Service Worker で
          有効化する。GitHub Pages 等カスタムヘッダ不可なホストでも crossOriginIsolated
          を立てるための定石。詳細は public/coi-serviceworker.js のヘッダコメント参照。
          beforeInteractive で他スクリプトより前に登録 → 必要なら 1 回リロード。
        */}
        <Script
          src={`${BASE_PATH}/coi-serviceworker.js`}
          strategy="beforeInteractive"
        />
      </head>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
