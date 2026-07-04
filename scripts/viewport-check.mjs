#!/usr/bin/env node
/**
 * 全ビューポート表示検証(再発防止フローの機械化)。
 *
 * UI を変更したら、確定前に必ず PC・タブレット(複数)・iPhone(複数)の幅で
 * 表示崩れが無いことを検証する。本スクリプトは Playwright で幅マトリクスを回し、
 *   - 横スクロールの発生(scrollWidth > innerWidth)
 *   - ヘッダ直下要素どうしの重なり
 * を機械判定し、各サイズのスクリーンショットを出力する。
 * 最後に代表画面(最小 320px・タブレット・PC)を必ず目視で確認すること
 * (文字の重なり・切れ・はみ出しが無いか)。全緑になるまで「完了」と言わない。
 *
 * 使い方:
 *   1) 開発サーバを起動:  npm run dev
 *   2) チャンネルを読ませるため、EPGStation の channels API を環境変数で渡す:
 *        MIRA_SOURCE_URL="https://<epgstation>/api/channels" node scripts/viewport-check.mjs
 *      (URL 未指定なら空状態=設定モーダルのみ検証)
 *   3) 出力: _work/viewport-check/*.png(gitignored)
 *
 * 前提: ローカルに Playwright が必要。
 *   npm i -D playwright && npx playwright install chromium
 *   (CI には載せない。ローカルの手動検証ツール。)
 *
 * 引数:
 *   --base <url>   検証対象(既定 http://localhost:3000)
 */

import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    "playwright が見つかりません。ローカルに導入してください:\n" +
      "  npm i -D playwright && npx playwright install chromium"
  );
  process.exit(2);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const OUT = resolve(REPO, "_work/viewport-check");
mkdirSync(OUT, { recursive: true });

const argv = process.argv.slice(2);
const baseIdx = argv.indexOf("--base");
const BASE = baseIdx >= 0 ? argv[baseIdx + 1] : "http://localhost:3000";
const SRC_URL = process.env.MIRA_SOURCE_URL || "";

const persisted = SRC_URL
  ? JSON.stringify({
      state: {
        source: { kind: "url", value: SRC_URL },
        selectedId: null,
        sidebarCollapsed: false,
        showSubChannels: false,
        externalPlayer: "vlc",
        externalM2tsMode: 0,
      },
      version: 0,
    })
  : null;

// PC 3 / タブレット 4 / iPhone 4(最小 320 を必ず含める)
const VIEWPORTS = [
  { name: "pc-1920", w: 1920, h: 1080 },
  { name: "pc-1440", w: 1440, h: 900 },
  { name: "laptop-1280", w: 1280, h: 800 },
  { name: "ipad-pro-land-1194", w: 1194, h: 834 },
  { name: "ipad-pro-port-834", w: 834, h: 1194 },
  { name: "ipad-air-820", w: 820, h: 1180 },
  { name: "ipad-mini-768", w: 768, h: 1024 },
  { name: "iphone-promax-430", w: 430, h: 932 },
  { name: "iphone-14-390", w: 390, h: 844 },
  { name: "iphone-se-375", w: 375, h: 667 },
  { name: "iphone-narrow-320", w: 320, h: 568 },
];

function rectsOverlap(a, b) {
  return !(
    a.x + a.width <= b.x + 1 ||
    b.x + b.width <= a.x + 1 ||
    a.y + a.height <= b.y + 1 ||
    b.y + b.height <= a.y + 1
  );
}

const results = [];
const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 2,
  });
  if (persisted) {
    await ctx.addInitScript((data) => {
      localStorage.setItem("mira-web", data);
    }, persisted);
  }
  const p = await ctx.newPage();
  const r = { name: vp.name, w: vp.w, h: vp.h, issues: [] };
  try {
    await p.goto(BASE, { waitUntil: "networkidle" });
    await p.waitForTimeout(persisted ? 3500 : 800);

    // ヘッダ要素の重なり
    const headerBoxes = await p.evaluate(() => {
      const h = document.querySelector("header");
      if (!h) return [];
      return [...h.children]
        .filter((el) => {
          const s = getComputedStyle(el);
          const rc = el.getBoundingClientRect();
          return s.display !== "none" && rc.width > 0 && rc.height > 0;
        })
        .map((el) => {
          const rc = el.getBoundingClientRect();
          return {
            label:
              el.getAttribute("aria-label") ||
              el.textContent?.trim().slice(0, 16) ||
              "",
            x: rc.x, y: rc.y, width: rc.width, height: rc.height,
          };
        });
    });
    for (let i = 0; i < headerBoxes.length; i++)
      for (let j = i + 1; j < headerBoxes.length; j++)
        if (rectsOverlap(headerBoxes[i], headerBoxes[j]))
          r.issues.push(
            `ヘッダ要素の重なり: "${headerBoxes[i].label}" x "${headerBoxes[j].label}"`
          );

    // 横スクロール
    const ov = await p.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
    }));
    if (ov.scrollW > ov.innerW + 1)
      r.issues.push(`横スクロール発生 (scrollW=${ov.scrollW} > innerW=${ov.innerW})`);

    await p.screenshot({ path: `${OUT}/${vp.name}-main.png` });

    // 設定モーダル(はみ出し)
    await p.click('[aria-label="設定"]').catch(() => {});
    await p.waitForTimeout(600);
    const modal = await p.evaluate(() => {
      const d = document.querySelector("[aria-labelledby=settings-title]");
      if (!d) return { present: false };
      const rc = d.getBoundingClientRect();
      return {
        present: true,
        overflow:
          rc.right > window.innerWidth + 1 ||
          rc.bottom > window.innerHeight + 1 ||
          d.scrollWidth > d.clientWidth + 1,
      };
    });
    if (modal.present && modal.overflow)
      r.issues.push("設定モーダルが画面外/横溢れ");
    await p.screenshot({ path: `${OUT}/${vp.name}-settings.png` });
  } catch (e) {
    r.issues.push("例外: " + e.message);
  }
  r.ok = r.issues.length === 0;
  results.push(r);
  await ctx.close();
  console.log(
    `${r.ok ? "OK " : "NG "} ${vp.name.padEnd(20)} ${r.issues.join(" / ")}`
  );
}

await browser.close();
const allOk = results.every((r) => r.ok);
console.log("\n出力:", OUT);
console.log("全OK:", allOk);
if (!allOk) process.exit(1);
