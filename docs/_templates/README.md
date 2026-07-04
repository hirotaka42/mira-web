# docs/_templates/ — ドキュメント雛形

新規ドキュメントは**手書きで起こさず、ここの雛形から始める**(`AGENTS-SHARED.md §8` 準拠)。
多くは `scripts/new-doc.mjs` が自動で雛形を展開するので、手で触るのは中身だけでよい。

| 雛形 | 用途 | 主な使い手 |
|---|---|---|
| `case-index.html` | バケット案件の目次(`docs/<bucket>/<5桁>/index.html`) | `new-doc.mjs case` |
| `phase.html` | フェーズ文書(`<2桁>-<phase>.html`) | `new-doc.mjs phase` |
| `doc.html` | 単発の自己完結ドキュメント(reference 区画・横断トピック等) | 手動コピー |
| `adr-template.md` | 設計決定の記録(ADR)。`reference/03_decisions/` へ | 手動コピー |
| `_parts/` | 分割→統合ワークフロー用の章節雛形 | 手動コピー → `assemble-doc.mjs` |

## プレースホルダ(scaffold が置換)

`{{TITLE}}` `{{BUCKET}}` `{{ID}}` `{{DATE}}` `{{PHASE_NUM}}` `{{PHASE_NAME}}` `{{PHASE_LABEL}}`
— `case-index.html` / `phase.html` 内のこれらは `new-doc.mjs` が自動で埋める。
手動で使う雛形(`doc.html` / `adr-template.md`)は `<…>` を自分で埋める。

## テーマ(ライト既定・ダーク切替・印刷対応)

3 つの HTML 雛形はすべて同じ CSS 変数を**インライン**で持つ:
- `:root` にライトパレット(白基調)、`html[data-theme="dark"]` でダーク値に上書き
- ページ右上のトグル(☀/☾)で切替、`localStorage` に保存
- `@media print` でダーク指定を強制ライトへ戻し、トグルを非表示
- 本文は `16px` / `line-height 1.8` / `letter-spacing 0.02em` / `font-feature-settings "palt" 1`
- フォントは `"Hiragino Sans","Noto Sans JP","Segoe UI",sans-serif`

パレットの正規値・トグル実装は `AGENTS-SHARED.md §8` を参照。**雛形のスタイルを変えると以後の生成物すべてに反映される**。

## 分割→統合ワークフロー(`_parts/` + `assemble-doc.mjs`)

長文・複数章のドキュメントは、章節ごとに `_parts/NN-section.html` として分割し、
最後に `scripts/assemble-doc.mjs` で 1 HTML に統合する(AGENTS-SHARED §8 参照)。

```sh
# 1. 案件ディレクトリ配下に _parts/ を作って雛形をコピー
mkdir -p docs/future/00001/_parts
cp docs/_templates/_parts/{00-head,01-section,99-foot}.html docs/future/00001/_parts/
mv docs/future/00001/_parts/01-section.html docs/future/00001/_parts/01-background.html

# 2. 各章を _parts/NN-*.html として作成・編集
$EDITOR docs/future/00001/_parts/01-background.html

# 3. 統合して 1 HTML を生成
node scripts/assemble-doc.mjs docs/future/00001/_parts/ \
     -o docs/future/00001/05-final-design.html

# 4. ライト/ダーク/印刷の 3 モードで表示確認(視覚レビュー)
open docs/future/00001/05-final-design.html
```

- **中間ファイル(`_parts/`)はコミットするが、`index.html` から参照しない**
- 小規模で済むドキュメントは分割せず、`<details>/<summary>` で章節化
- 詳しい運用は ai-skills の `assembling-html-doc` skill を参照
