# CLAUDE.md — mira-web リポジトリ全体図

> このファイルはこのリポジトリの「地図」(構成・成果物の対応表・どこに何があるか)に徹する。
> プロジェクト非依存の共通ルール(コミット規約・リリース完了定義・docs 体系・環境の罠 等)は
> `AGENTS-SHARED.md` に集約し、ここから import する。

## 参照宣言 (refs)
- path: ./AGENTS-SHARED.md   access: read-only   role: shared-rules
@AGENTS-SHARED.md

---

## 1. このリポジトリは何か

ブラウザだけで完結する Mirakurun / EPGStation 用の IPTV プレイヤー(Next.js 静的書き出し + PWA)。
サーバ側でストリームを処理せず、GitHub Pages から配信してブラウザが Mirakurun / EPGStation に直接接続する。
利用者向けの説明・セットアップ手順は `README.md` を正とする。

## 2. 可視性の方針

- このリポジトリは **public**。GitHub Pages(静的サイト配信)で公開するため。
- 到達情報を含む具体値(自宅サーバの URL 等)はコードにコミットしない。プレイリスト URL は
  リポジトリ Variables の `PLAYLIST_PRESETS`(ビルド時注入)またはブラウザの localStorage にのみ置く。

## 3. 構成と「どこに何があるか」

- `app/` — Next.js App Router(単一ページ)。レイアウト・PWA manifest。
- `components/` — UI コンポーネント。プレイヤー 2 種(`TsLivePlayer` = Mirakurun 生 TS / `HlsPlayer` = EPGStation HLS)、
  `Sidebar` / `TopBar` / `SettingsModal` / `EpgPanel` / `StatsPanel` / `GlobalHotkeys` / `ExternalPlayerButton` 等。
- `lib/` — ロジック(m3u パース、EPGStation 連携、サブチャンネル判定、外部プレイヤー URL、zustand store)。
  単体テストは同階層の `*.test.ts`(vitest・node 環境。UI テストは `// @vitest-environment jsdom`)。
- `public/` — 静的アセット。`coi-serviceworker.js`(TS 直モードの SharedArrayBuffer 用)。
- `scripts/` — 補助スクリプト(`scripts/README.md` 参照)。
- `docs/` — ドキュメント(3 バケット issue/future/project + reference 区画)。`AGENTS-SHARED.md §8` 準拠。
- `.github/workflows/deploy.yml` — CI/CD(下記 §5)。

## 4. 成果物の対応表(版の出どころ・タグ・対応範囲)

- 成果物は **GitHub Pages の静的サイト 1 つ**(`npm run build` → `out/`)。
- 版ゲート・タグは採用していない。`main` への push ごとに最新をデプロイする(§5)。

## 5. リリースワークフローの所在

- `.github/workflows/deploy.yml` — `main` push で 型検査 → テスト → 静的ビルド → GitHub Pages デプロイ。
- デプロイの完了確認は run の `build` / `deploy` 両ジョブの success まで見る(AGENTS-SHARED §5)。
  Pages 側の一時エラー(「Deployment failed, try again later.」)は時間をおいて失敗ジョブのみ再実行する。

## 6. ローカル作業領域

- `_work/` は使い捨て作業領域(gitignored)。設計 HTML・ビルド成果物・録画など。**コミットしない**。

## 7. 教訓(再発防止 — AI が育てる節)

<!-- AGENTS-SHARED §11 に従い、AI が追記・棚卸しする(追記は都度ユーザーに確認)。
     同じ注意・同じエラーの「2 回目」で追記する。この節以外は AI が勝手に書き換えない。
     形式: - [YYYY-MM-DD] 事象 → 原因 → 次からどうする -->
- [2026-07-04] バックグラウンドの委任エージェント(fast-worker 等)が停止しているのに「稼働中」と誤認して長時間放置し、ユーザーを待たせた → 完了指標(ブランチ push の有無)だけを見て「生存」を確認していなかった。停止と「遅いだけ」を区別できていなかった → **委任中は生存を能動確認する**: transcript(tasks/<agentId>.output)の最終イベント時刻が進んでいるかで判定し、数分間進んでいなければ停止とみなして自分で引き取る。状況報告は「まだ完了していない」ではなく「前進している証拠」を根拠にする。**原因も修正も自分で確定済みの小さな変更は委任せず直接行う**(今回の Safari fetch 修正は自分で 5 分で直せた)。
- [2026-07-04] iPhone/iPad の Safari で全データ取得が失敗 → `lib/safeFetch.ts` の `buildFetchInit` が Chromium 専用の非標準 fetch オプション `targetAddressSpace` を付与しており、Safari(WebKit)がこれを `TypeError` で拒否していた → ブラウザ非標準の fetch オプションは feature detection(`new Request(url, {opt})` が例外を投げるか)してから付ける。フロントの動作確認は Chrome だけでなく実機 Safari でも行う(safaridriver 経由で WebDriver 操作できる)。
