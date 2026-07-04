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
