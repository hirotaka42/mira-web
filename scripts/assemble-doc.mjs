#!/usr/bin/env node
// 分割→統合ワークフロー(AGENTS-SHARED.md §8)。
// _parts/NN-*.html を連番順に結合して 1 HTML を出力する。
//
//   node scripts/assemble-doc.mjs <parts ディレクトリ> -o <出力 HTML>
//   node scripts/assemble-doc.mjs <parts ディレクトリ> --output <出力 HTML>
//
// 動作:
//   ・指定ディレクトリ直下の NN-*.html(2 桁ゼロ埋め連番 + ハイフン + 拡張子 .html)を
//     辞書順で読み、改行で連結して出力する。
//   ・00-*.html が先頭(<head>+トグル+wrap 開始)、99-*.html が末尾(footer+閉じタグ)になる前提。
//   ・各 part の末尾空白は除き、間に改行 1 つを挟んで結合する。それ以外は無加工。
//   ・出力先パスのディレクトリは存在している必要がある(勝手には作らない)。
//
// 例:
//   node scripts/assemble-doc.mjs docs/future/00001/_parts/ \
//        -o docs/future/00001/05-final-design.html

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function die(msg) { console.error('エラー: ' + msg); process.exit(1); }

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  console.log('使い方: node scripts/assemble-doc.mjs <parts ディレクトリ> -o <出力 HTML>');
  console.log('  parts ディレクトリ直下の NN-*.html を連番順に結合して 1 HTML を出力します。');
  process.exit(args.length === 0 ? 1 : 0);
}

let partsDir = null;
let output = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '-o' || a === '--output') {
    output = args[++i];
    if (!output) die('-o の後に出力ファイルパスを指定してください');
  } else if (partsDir === null) {
    partsDir = a;
  } else {
    die('引数が多すぎます: ' + a);
  }
}
if (!partsDir) die('parts ディレクトリを指定してください');
if (!output) die('-o <出力 HTML> を指定してください');

try {
  if (!statSync(partsDir).isDirectory()) die(`parts はディレクトリではありません: ${partsDir}`);
} catch (e) {
  die(`parts ディレクトリを開けません: ${partsDir} (${e.message})`);
}

const files = readdirSync(partsDir)
  .filter(n => /^\d{2}-[a-z0-9-]+\.html$/.test(n))
  .sort();

if (files.length === 0) {
  die(`NN-*.html (2桁連番 + ケバブ) が見つかりません: ${partsDir}`);
}

const chunks = files.map(name => {
  const body = readFileSync(join(partsDir, name), 'utf8').replace(/\s+$/g, '');
  return body;
});
const out = chunks.join('\n') + '\n';

writeFileSync(output, out, 'utf8');
console.log(`✓ ${files.length} parts を結合 → ${output}`);
for (const f of files) console.log('  + ' + f);
console.log('\n表示レビュー(AGENTS-SHARED §8): ライト/ダーク/印刷の 3 モードで目視確認してください。');
