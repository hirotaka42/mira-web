# scripts/ — 補助スクリプト

## new-doc.mjs — docs scaffold(連番採番つき)

`AGENTS-SHARED.md §8` のドキュメント体系(3 バケット・5桁ゼロ埋め連番・フェーズ・台帳 index)を
手作業のミス無しに守らせるためのスクリプト。Node.js 製(依存なし)。

```sh
# 新しい案件を起票(バケットの最大番号+1 を自動採番し、台帳にもカードを追加)
node scripts/new-doc.mjs case issue "設定画面の不具合"
# その案件にフェーズ文書を追加
node scripts/new-doc.mjs phase issue 00001 01-investigation
```

## assemble-doc.mjs — 分割 HTML の統合

長文ドキュメントを `_parts/NN-*.html` で章単位に分割編集し、1 つの自己完結 HTML に統合する
(`AGENTS-SHARED.md §8` の分割 → 統合ワークフロー)。

```sh
node scripts/assemble-doc.mjs <_parts ディレクトリ> -o <出力 HTML>
```

## generate-icons.mjs — PWA アイコン再生成

PWA アイコン PNG を SVG マスターから再生成する(アイコンのデザイン変更時のみ)。

```sh
node scripts/generate-icons.mjs
```

## viewport-check.mjs — 全ビューポート表示検証(UI 変更時は必須)

UI を変えたら**確定前に必ず**、PC・タブレット(複数)・iPhone(複数)の幅で表示崩れが
無いことを検証する(`CLAUDE.md §7` の教訓)。Playwright で幅マトリクス(pc 1920/1440/1280・
tablet 1194/834/820/768・phone 430/390/375/**320**)を回し、横スクロール発生と
ヘッダ要素の重なりを機械判定し、各サイズのスクショを `_work/viewport-check/` に出力する。
**機械判定が全緑でも、最小 320px・タブレット・PC の代表画面は必ず目視**すること
(文字の重なり・切れ・はみ出し)。

```sh
# 前提(ローカルのみ。CI には載せない):
npm i -D playwright && npx playwright install chromium
# 開発サーバを起動しておく
npm run dev
# チャンネルを読ませて検証(EPGStation の channels API を環境変数で渡す)
MIRA_SOURCE_URL="https://<epgstation>/api/channels" node scripts/viewport-check.mjs
```

URL(到達情報)はコードにハードコードしない。環境変数で渡す(`CLAUDE.md §2`)。
