import type { Metadata } from "next";
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
  title: "mira-web",
  description: "Static browser-only Mirakurun IPTV viewer",
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
