# mira-web

Static browser-only Mirakurun IPTV viewer — WASM (ts-live.js) decoding, m3u stored in localStorage.

ブラウザだけで完結する Mirakurun 互換 IPTV プレイヤーです。サーバ側でストリームを処理しないため、GitHub Pages のような完全静的ホスティングにそのままデプロイできます。

## 特徴

- **完全静的**: API ルートなし。GitHub Pages / Cloudflare Pages / 任意の静的ホストで動作
- **ブラウザ内デコード**: [`ts-live.js`](https://github.com/kounoike/ts-live) (Emscripten + ffmpeg + WebGPU + WebCodecs) で MPEG-2 video / AAC を復号
- **m3u はローカル保存のみ**: 設定はブラウザの `localStorage` にのみ保存。サーバ側に何も置かない
- **Mirakurun への通信もブラウザから直接**: 中継サーバなし。Tailscale など private network 越しでも Private Network Access で対応
- **収納式サイドバー UI**: チャンネル選択 / 検索 / EPG・統計パネル

## ブラウザ要件

ts-live.js が **WebGPU + WebCodecs + SharedArrayBuffer** に依存し、かつ日本の地上波が **MPEG-2 video** で配信されるため、対応ブラウザは限定的です。

| プラットフォーム | ブラウザ | 動作 |
|---|---|---|
| **macOS / Windows / Linux** | Chrome / Edge 113+ | ✅ 動作確認済 |
| **macOS** | Safari 18+ | ✅ 想定動作 |
| **iOS / iPadOS** | Safari / Chrome / Edge / Firefox | ❌ **動作しません** (詳細下記) |
| 全プラットフォーム | Firefox stable | ❌ WebGPU が experimental flag のため不可 |

### iOS / iPadOS が使えない理由 (Mirakurun 直モードの場合)

- iOS 上のブラウザは **すべて WebKit ベース** (Apple 規約によりレンダリングエンジンの差替不可)
- WebGPU は iOS 18 / iPadOS 18 以降で Feature Flag を有効化すれば動作するが…
- **WebCodecs の VideoDecoder が MPEG-2 video を復号できない** ため、ts-live.js のパイプラインが完成しない
- 結果として地上波 (MPEG-2) を含むストリームは現状再生できません

### iOS で観たいときは EPGStation HLS モードを使う

設定モーダルの URL に **EPGStation の `/api/channels` エンドポイント** を入れると、自動で HLS 起動 URL の m3u に変換され、`<video>` タグでネイティブ再生されます (Safari は HLS をネイティブサポート、他ブラウザは hls.js)。サーバ側で H.264 にトランスコードされるので iOS でもそのまま再生可。

```
URL の例: https://<your-epgstation>/api/channels
```

mira-web は URL パターンを見て、`/api/channels` なら自動で HLS m3u を組み立て、Mirakurun のプレイリストならば従来の ts-live.js モードに切り替えます (チャンネル単位の自動振り分け)。

## ホスティング側要件

GitHub Pages のように HTTP ヘッダを足せないホストでも、同梱の Service Worker (`public/coi-serviceworker.js`) が `Cross-Origin-Opener-Policy: same-origin` / `Cross-Origin-Embedder-Policy: require-corp` を注入するため `SharedArrayBuffer` が利用できるようになります。初回訪問時に 1 回だけ自動リロードが入ります。

## Mirakurun 側に必要な設定

ブラウザから直接 Mirakurun に接続するため、以下の 2 点が必要です。

1. **Mirakurun を HTTPS で公開する**
   GitHub Pages は HTTPS のため、Mirakurun が `http://` のままだと mixed-content でブロックされます。下記のいずれかで HTTPS 化してください。
   - Tailscale Funnel (`tailscale funnel ...`)
   - Cloudflare Tunnel (`cloudflared`)
   - リバースプロキシ (Caddy 等) + Let's Encrypt

2. **Mirakurun の `allowOrigins` に Pages の URL を追加**
   `~/.config/mirakurun/server.yml` または `/etc/mirakurun/server.yml`:
   ```yaml
   allowOrigins:
     - "https://<your-username>.github.io"
   allowPNA: true
   ```
   追加後 Mirakurun を再起動。`allowPNA: true` は Tailscale や LAN 上のホストへ public origin から PNA preflight 経由で接続する場合に必要 (デフォルト true)。

## 開発

```bash
npm install
npm run dev
# → http://localhost:3000
```

ローカル dev でも Cross-Origin Isolation が必要なので、初回アクセス時に Service Worker 登録のため自動リロードが入ります。Mirakurun の `allowOrigins` に `http://localhost:3000` も追加しておくと便利。

### 主要コマンド

| | |
|---|---|
| `npm run dev` | 開発サーバ |
| `npm run build` | 静的書き出し → `out/` |
| `npm run typecheck` | TypeScript 型検査のみ |

## デプロイ (GitHub Pages)

1. GitHub リポジトリの **Settings → Pages** で source を **GitHub Actions** に設定
2. `main` に push すると [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) が走って自動デプロイ
3. 数十秒後 `https://<user>.github.io/<repo>/` で公開

### サブパスの取り扱い

ワークフローでは環境変数 `NEXT_PUBLIC_BASE_PATH=/<repo>` を渡しています ([deploy.yml](.github/workflows/deploy.yml))。

- **ユーザーサイト** (`<user>.github.io` 直下にデプロイ) や **カスタムドメイン (CNAME)** を使う場合は、`NEXT_PUBLIC_BASE_PATH` を空文字に変更してください

### m3u プレイリスト URL のプリセット (任意)

GitHub の **Settings → Secrets and variables → Actions → Variables** に以下のいずれかを設定すると、設定モーダルの URL タブにプリフィルされます。

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

#### 方式2: 単一 URL のみ (後方互換)

`DEFAULT_PLAYLIST_URL` という Variable に URL 1 つだけ。`PLAYLIST_PRESETS` が未設定のときに使われる。

> Tailscale など private network 経由でしか到達しないホストならば、URL 自体は
> 公開しても実害はないため Variable で問題ありません。public exposed な
> Mirakurun / EPGStation の URL は Variable に置かないでください。

### URL のクリップボード貼付

URL 入力欄の右側にある **クリップボードボタン**で `navigator.clipboard.readText()` から URL を貼り付けられます (権限プロンプトが出る場合があります)。

## セキュリティ

- 設定 (m3u URL / 貼付けテキスト / 選択チャンネル) はブラウザの `localStorage` にのみ保存。リモートに送られない
- 全ての fetch は `credentials: "omit"` で発行 (Cookie 漏洩なし)
- ユーザー入力 URL は `http/https` プロトコルだけに制限
- mixed-content 検出時は早期エラー
- リポジトリには `.m3u` ファイルを含めない (`.gitignore` 済)

## 謝辞

- [Mirakurun](https://github.com/Chinachu/Mirakurun) — DVR Tuner Server for Japanese TV
- [ts-live.js](https://github.com/kounoike/ts-live) — Emscripten ベースのブラウザ内 MPEG-TS デコーダ
- [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker) — Cross-Origin Isolation 注入の実装パターン
