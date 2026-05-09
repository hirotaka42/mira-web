#!/usr/bin/env node
/**
 * Mira WebUI のアプリアイコンを生成する。
 *
 * SVG マスターを sharp で各サイズの PNG にラスタライズし、Next.js が
 * 自動認識する場所 (app/icon.png, app/apple-icon.png) に書き出す。
 *
 * 実行: `node scripts/generate-icons.mjs`
 *   - 通常はリポジトリにコミットされた PNG を使うので開発中の再生成は不要
 *   - SVG (デザイン) を変えたら手動で再実行 → コミット
 */

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// 角丸 + グラデ + "M" モチーフ (TopBar の ▣ + cyan ブランド)。
// iOS は自動で角丸マスクを掛けるので、background は四角全面塗りでよい。
// maskable 用は中央 80% に主要要素を集める。
const BG = "#0891b2"; // cyan-600
const FG = "#ecfeff"; // cyan-50
const SHADOW = "#0e7490"; // cyan-700

// 標準アイコン (square - iOS が rounded mask)
const SVG_NORMAL = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BG}"/>
      <stop offset="100%" stop-color="${SHADOW}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <!-- ▣ ライク + M -->
  <rect x="96" y="96" width="320" height="320" rx="32" fill="none" stroke="${FG}" stroke-width="14" stroke-opacity="0.25"/>
  <g fill="${FG}" font-family="-apple-system, BlinkMacSystemFont, system-ui, sans-serif" font-weight="700" text-anchor="middle">
    <text x="256" y="328" font-size="220">M</text>
  </g>
</svg>`;

// maskable: 中央 80% に主要要素 (Android Adaptive Icon の safe area)
const SVG_MASKABLE = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BG}"/>
      <stop offset="100%" stop-color="${SHADOW}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g fill="${FG}" font-family="-apple-system, BlinkMacSystemFont, system-ui, sans-serif" font-weight="700" text-anchor="middle">
    <text x="256" y="320" font-size="180">M</text>
  </g>
</svg>`;

const targets = [
  // Next.js が自動で <link> 出力する位置
  { svg: SVG_NORMAL, size: 192, path: "app/icon.png" },
  { svg: SVG_NORMAL, size: 180, path: "app/apple-icon.png" },
  // manifest 用 (大サイズ + maskable)
  { svg: SVG_NORMAL, size: 512, path: "public/icon-512.png" },
  { svg: SVG_MASKABLE, size: 512, path: "public/icon-maskable-512.png" },
];

for (const t of targets) {
  const out = join(ROOT, t.path);
  await sharp(Buffer.from(t.svg)).resize(t.size, t.size).png().toFile(out);
  console.log(`✓ ${t.path} (${t.size}x${t.size})`);
}

// SVG master も保管 (デザイン変更時の起点)
writeFileSync(join(ROOT, "public/icon-master.svg"), SVG_NORMAL);
writeFileSync(join(ROOT, "public/icon-maskable-master.svg"), SVG_MASKABLE);
console.log("✓ public/icon-master.svg, icon-maskable-master.svg");
