#!/usr/bin/env node
// docs scaffold — AGENTS-SHARED.md §8 の連番・フェーズ・ダークテーマを機械的に守らせる。
//
//   node scripts/new-doc.mjs case  <bucket> "<タイトル>"
//   node scripts/new-doc.mjs phase <bucket> <id> <NN-phase>
//
//   bucket : issue | future | project
//   id     : 5桁ゼロ埋め(例 00001)。case が採番して表示する。
//   phase  : 例 01-investigation / 03-design-proposals
//
// 動作:
//   case  … docs/<bucket>/ の最大連番+1 で新ディレクトリを作り、case-index 雛形を展開、
//           バケット台帳 index.html にカードを自動挿入する(採番重複を防ぐ)。
//   phase … 既存案件に <NN-phase>.html を雛形から展開、案件 index.html にフェーズカードを挿入する。

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(SCRIPT_DIR);
const DOCS = join(ROOT, 'docs');
const TPL = join(DOCS, '_templates');
const BUCKETS = ['issue', 'future', 'project'];

const PHASE_LABELS = {
  'investigation': '調査',
  'improvement': '改善',
  'design-proposals': '設計案',
  'validation-audit': '検証・洗い出し',
  'final-design': '最終設計',
  'implementation-record': '実装記録',
};

function die(msg) { console.error('エラー: ' + msg); process.exit(1); }
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function today() { const d = new Date(); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; }

function nextId(bucketDir) {
  const nums = readdirSync(bucketDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && /^\d{5}$/.test(e.name))
    .map(e => parseInt(e.name, 10));
  const max = nums.length ? Math.max(...nums) : 0;
  return String(max + 1).padStart(5, '0');
}

function fill(tplName, vars) {
  let s = readFileSync(join(TPL, tplName), 'utf8');
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{{${k}}}`, v);
  return s;
}

// マーカー直前に挿入し、空状態のプレースホルダ段落を取り除く。
function insertBefore(filePath, marker, snippet, emptyRe) {
  let html = readFileSync(filePath, 'utf8');
  if (!html.includes(marker)) die(`${filePath} に挿入マーカー ${marker} が無い`);
  if (emptyRe) html = html.replace(emptyRe, '');
  html = html.replace(marker, snippet + '\n  ' + marker);
  writeFileSync(filePath, html, 'utf8');
}

const [, , cmd, bucket, a3, a4] = process.argv;

if (!BUCKETS.includes(bucket)) die(`bucket は ${BUCKETS.join(' / ')} のいずれか`);
const bucketDir = join(DOCS, bucket);
if (!existsSync(bucketDir)) die(`${bucketDir} が無い`);

if (cmd === 'case') {
  const title = a3;
  if (!title) die('タイトルを指定する: new-doc.mjs case <bucket> "<タイトル>"');
  const id = nextId(bucketDir);
  const caseDir = join(bucketDir, id);
  mkdirSync(caseDir);
  const date = today();
  writeFileSync(join(caseDir, 'index.html'),
    fill('case-index.html', { ID: id, TITLE: esc(title), BUCKET: bucket, DATE: date }), 'utf8');

  const card =
`<a class="card" href="${id}/index.html">
    <h2>#${id} — ${esc(title)}</h2>
    <p>&lt;概要を1〜2文で&gt;</p>
    <div class="tags">
      <span class="tag">起票: ${date}</span>
      <span class="tag st st-open">提案中(承認待ち)</span>
    </div>
  </a>`;
  insertBefore(join(bucketDir, 'index.html'), '<!-- new-doc:insert',
    card, /\s*<p class="empty">[\s\S]*?<\/p>/);

  console.log(`作成: docs/${bucket}/${id}/index.html`);
  console.log(`台帳更新: docs/${bucket}/index.html にカードを挿入`);
  console.log(`次: node scripts/new-doc.mjs phase ${bucket} ${id} 01-investigation`);

} else if (cmd === 'phase') {
  const id = a3, phase = a4;
  if (!/^\d{5}$/.test(id || '')) die('id は5桁ゼロ埋め(例 00001)');
  if (!/^\d{2}-[a-z0-9-]+$/.test(phase || '')) die('phase は <NN-kebab>(例 01-investigation)');
  const caseDir = join(bucketDir, id);
  if (!existsSync(caseDir)) die(`${caseDir} が無い。先に case を作る`);
  const num = phase.slice(0, 2);
  const name = phase.slice(3);
  const label = PHASE_LABELS[name] || name;
  const out = join(caseDir, `${phase}.html`);
  if (existsSync(out)) die(`${out} は既にある`);
  writeFileSync(out,
    fill('phase.html', { ID: id, BUCKET: bucket, PHASE_NUM: num, PHASE_NAME: name, PHASE_LABEL: esc(label) }), 'utf8');

  const card =
`<a class="card" href="${phase}.html">
    <h3>${num} — ${esc(label)}</h3>
    <p>&lt;このフェーズの内容&gt;</p>
  </a>`;
  insertBefore(join(caseDir, 'index.html'), '<!-- new-doc:phase-insert',
    card, /\s*<p style="color:var\(--tx2\)">まだフェーズ[\s\S]*?<\/p>/);

  console.log(`作成: docs/${bucket}/${id}/${phase}.html`);
  console.log(`目次更新: docs/${bucket}/${id}/index.html にフェーズカードを挿入`);

} else {
  die('usage: new-doc.mjs case <bucket> "<title>" | phase <bucket> <id> <NN-phase>');
}
