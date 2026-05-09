# mira-web

Static browser-only Mirakurun / EPGStation IPTV viewer — installable as a PWA.

ブラウザだけで完結する Mirakurun / EPGStation 互換 IPTV プレイヤーです。サーバ側でストリームを処理しないため、GitHub Pages のような完全静的ホスティングにそのままデプロイでき、iOS / iPadOS では「ホーム画面に追加」で全画面 PWA として起動できます。

## 特徴

- **完全静的**: API ルートなし。GitHub Pages / Cloudflare Pages / 任意の静的ホストで動作
- **2 つの再生モードを自動切替**:
  - **TS 直 (高画質)**: Mirakurun から MPEG-TS を直接受け取り、[`ts-live.js`](https://github.com/kounoike/ts-live) (Emscripten + ffmpeg + WebGPU + WebCodecs) で MPEG-2 video / AAC をブラウザ内復号
  - **HLS (iOS 互換)**: EPGStation の HLS ライブストリームを native `<video>` (Safari) または hls.js で再生
- **PWA 対応**: ホーム画面に追加で URL バー無しの全画面アプリとして起動 (iOS / Android / Desktop Chrome すべて)
- **m3u はローカル保存のみ**: 設定はブラウザの `localStorage` にのみ保存。サーバ側に何も置かない
- **EPG (番組情報) 表示**: EPGStation の `/api/schedules/broadcasting` から現在放送中の番組名・時間・進捗・あらすじを表示
- **Mirakurun / EPGStation への通信もブラウザから直接**: 中継サーバなし。Tailscale 等 private network 越しでも対応
- **収納式サイドバー UI**: チャンネル選択 / 検索 / グループ折りたたみ / 選択中チャンネルへ自動スクロール

## 再生モードと対応ブラウザ

mira-web は m3u プレイリストの URL パターンを見て自動で再生モードを切り替えます。

| URL パターン | モード | 復号方式 | 対応ブラウザ |
|---|---|---|---|
| Mirakurun の `/api/iptv/playlist` 系 | **TS 直 (ts-live.js)** | WebGPU + WebCodecs + WASM | Chrome / Edge 113+ / macOS Safari 18+ (= WebGPU 必須) |
| EPGStation の `/api/channels` | **HLS** | サーバ側 H.264 トランスコード → native HLS / hls.js | iOS / iPadOS Safari, macOS Safari, Chrome / Edge / Firefox |

### iOS / iPadOS では HLS モードを使う

iOS / iPadOS は WebKit が WebGPU + MPEG-2 を持たないため TS 直モードは使えません。EPGStation を立てて `/api/channels` を URL に指定することで、サーバ側 H.264 トランスコード経由の HLS で iOS / iPad / iPhone でも視聴できます。

### iPad と iPhone の差

同じ Safari でも iPhone は **iCloud プライベートリレー / Local Network Access の制約** により、URL モードでの cross-origin fetch が無音失敗するケースがあります (iPad / Mac では発生しない)。回避策として **テキスト貼付 + Base URL 指定** ルートを用意しています (下記「iPhone 向けの回避ルート」参照)。

EPGStation 側の HLS 配信は **必ず H.264 + AAC で再エンコード** されている必要があります (iOS の AVPlayer が MPEG-2 / AC-3 を受け付けないため)。`config.yml` の `stream` セクションの ffmpeg コマンドに `-c:v libx264 -c:a aac` 系が入っているか確認してください。

## ホスティング側要件 (TS 直モード使用時のみ)

ts-live.js は `SharedArrayBuffer` が必要で、それには Cross-Origin Isolation (`COOP=same-origin` + `COEP=require-corp`) ヘッダが必要です。GitHub Pages のような HTTP ヘッダ追加不可なホストでも、同梱の Service Worker (`public/coi-serviceworker.js`) がこれを注入します。

- WebGPU が無い環境 (iPhone Safari など) では **COI Service Worker は登録されません** (HLS モードのみで使うので不要)。これにより iOS Safari の cross-origin fetch が壊れる問題を回避

## Mirakurun 側に必要な設定

ブラウザから直接 Mirakurun に接続するため:

1. **Mirakurun を HTTPS で公開する**
   GitHub Pages は HTTPS のため `http://` のままだと mixed-content でブロックされます。下記のいずれかで HTTPS 化:
   - **Tailscale Serve** (推奨、tailnet 内のみ): `tailscale serve --bg --https=443 http://localhost:40772`
   - Cloudflare Tunnel
   - リバースプロキシ (Caddy 等) + Let's Encrypt

2. **`allowOrigins` に Pages の URL を追加**
   ```yaml
   # /usr/local/etc/mirakurun/server.yml
   allowOrigins:
     - "https://mirakurun-secure-contexts-api.pages.dev"
     - "https://<your-username>.github.io"
   allowPNA: true
   ```
   追加後 Mirakurun を再起動。

## EPGStation 側に必要な設定 (HLS モード + EPG パネル使用時)

1. **HTTPS 化**: 同上 (Tailscale Serve 等)
2. **CORS ヘッダ**: EPGStation 自身は CORS を返さないので、**Caddy 等のリバースプロキシをサイドカーで** 立てて `Access-Control-Allow-Origin: *` / `Cross-Origin-Resource-Policy: cross-origin` / `Access-Control-Allow-Private-Network: true` を付与
3. **PNA preflight**: Caddy 側で OPTIONS リクエストに 204 + 上記ヘッダを返す

サンプルの Caddyfile + docker-compose は別途用意してください ([本リポジトリのコミット履歴](https://github.com/hirotaka42/mira-web/commits/main) 参照)。

## 設定モーダルの機能

mira-web の右上歯車アイコンから:

- **URL タブ** — m3u or EPGStation `/api/channels` URL を入れる。プリセットドロップダウン (CI で `PLAYLIST_PRESETS` 設定時) と クリップボードボタン
- **テキスト タブ** — m3u を直接貼り付け、または EPGStation の `/api/channels` JSON を貼り付け (自動検出して HLS 起動 URL の m3u に変換)
- **ファイル タブ** — `.m3u` / `.m3u8` / `.json` ファイルをアップロード
  - テキスト/ファイル経由の場合は **Base URL** を併記すると、Mirakurun の m3u 内に埋め込まれた `http://` を `https://` に書き換え (mixed-content 回避) + EPGStation JSON の HLS 起動 URL の origin を組み立てに使用
- **🧽 キャッシュをクリア** — Service Worker と Cache Storage を消去 + リロード (m3u 設定は維持)
- **🗑 設定を削除** — localStorage の m3u 設定を削除

### iPhone (URL モードが使えない環境) 向けの回避ルート

iPhone Safari は iCloud プライベートリレーや Local Network Access の都合で
URL モードの fetch が無音失敗するケースがあります。その場合は:

1. PC やターミナルで `curl https://your-epgstation/api/channels > channels.json` などで JSON を取得
2. mira-web の **テキストタブ** に貼り付け (または **ファイルタブ** で `channels.json` をアップロード)
3. **Base URL** に EPGStation の URL (例: `https://your-epgstation/api/channels`) を入力
4. 「テキストを適用」 / ファイル選択で再生開始

Mirakurun の m3u も同じ手順 (m3u テキスト貼付 + Base URL に Mirakurun の URL) で iPhone から再生可能。

## EPG (番組情報) パネル

再生中チャンネルの現在放送中の番組名・時間・残り時間・進捗バー・あらすじを表示。30 秒ごと自動更新 + 番組終了直前に再取得。EPGStation の `/api/schedules/broadcasting?isHalfWidth=true` から取得 (EPG ソースは EPGStation 1 本に統一)。Mirakurun 直モードでも `PLAYLIST_PRESETS` に EPGStation の URL が登録されていれば自動でそちらから取得します。

## ストリーム情報パネル

再生中の解像度・ビットレート・コーデック・バッファ・ドロップを表示。ビットレートは:
- TS 直モード: 入力 TS の流量から実効値を計算
- HLS hls.js モード: m3u8 宣言値 (`hls.levels[currentLevel].bitrate`)
- HLS Safari ネイティブモード: PerformanceObserver で `.ts` セグメントの transfer size を計測

## PWA インストール

- **iOS Safari**: 共有ボタン → 「ホーム画面に追加」
- **Android Chrome**: メニュー → 「ホーム画面に追加」
- **Desktop Chrome / Edge**: アドレスバー右のインストールアイコン

ホーム画面の Mira アイコンから起動すると URL バー無しの全画面アプリとして動作します。

## 開発

```bash
npm install
npm run dev
# → http://localhost:3000
```

### 主要コマンド

| | |
|---|---|
| `npm run dev` | 開発サーバ |
| `npm run build` | 静的書き出し → `out/` |
| `npm run typecheck` | TypeScript 型検査のみ |
| `npm test` | Vitest ユニットテスト |
| `node scripts/generate-icons.mjs` | PWA アイコン PNG を SVG マスターから再生成 (デザイン変更時のみ) |

## デプロイ (GitHub Pages)

1. GitHub リポジトリの **Settings → Pages** で source を **GitHub Actions** に設定
2. `main` に push すると [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) が走って自動デプロイ
3. 数十秒後 `https://<user>.github.io/<repo>/` で公開

### サブパスの取り扱い

ワークフローでは環境変数 `NEXT_PUBLIC_BASE_PATH=/<repo>` を渡します ([deploy.yml](.github/workflows/deploy.yml))。

- **ユーザーサイト** (`<user>.github.io` 直下) や **カスタムドメイン (CNAME)** を使う場合は `NEXT_PUBLIC_BASE_PATH` を空文字に上書き

### m3u プレイリスト URL のプリセット (任意)

GitHub の **Settings → Secrets and variables → Actions → Variables** に:

#### 方式1: 複数プリセット (推奨)

`PLAYLIST_PRESETS` という Variable に **JSON 配列**:

```json
[
  {"name": "EPGStation HLS (iOS OK)", "url": "https://your-epgstation/api/channels"},
  {"name": "Mirakurun (高画質)",      "url": "https://your-mirakurun/api/iptv/playlist"}
]
```

- 1件目が URL タブの初期値 (プリフィル)
- 2件以上ある場合は **ドロップダウン**で切替可能
- EPGStation の URL があれば、Mirakurun モード再生中も EPG パネルがそれを使って番組情報を取得

#### 方式2: 単一 URL のみ (後方互換)

`DEFAULT_PLAYLIST_URL` という Variable に URL 1 つだけ。`PLAYLIST_PRESETS` 未設定時に使用。

> Tailscale 等 private network 経由でしか到達しないホストならば、URL 自体は
> 公開しても実害はないため Variable で問題ありません。public exposed な
> Mirakurun / EPGStation の URL は Variable に置かないでください。

## セキュリティ

- 設定 (m3u URL / 貼付けテキスト / 選択チャンネル) はブラウザの `localStorage` にのみ保存。リモートに送られない
- 全ての fetch は `credentials: "omit"` で発行 (Cookie 漏洩なし)
- ユーザー入力 URL は `http/https` プロトコルだけに制限
- mixed-content (HTTPS ページから HTTP fetch) を fetch 前に検出
- リポジトリには `.m3u` ファイルを含めない (`.gitignore` 済)

## 謝辞

- [Mirakurun](https://github.com/Chinachu/Mirakurun) — DVR Tuner Server for Japanese TV
- [EPGStation](https://github.com/l3tnun/EPGStation) — Mirakurun 用録画フロントエンド
- [ts-live.js](https://github.com/kounoike/ts-live) — Emscripten ベースのブラウザ内 MPEG-TS デコーダ
- [hls.js](https://github.com/video-dev/hls.js) — non-Safari ブラウザの HLS 再生
- [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker) — Cross-Origin Isolation 注入の実装パターン
