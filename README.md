# mira-web

ブラウザだけで完結する Mirakurun / EPGStation 用の IPTV プレイヤー。

Mirakurun または EPGStation が動作している環境を前提に、サーバ側でストリームを処理せずブラウザから直接再生します。GitHub Pages のような完全静的ホスティングにそのままデプロイでき、iOS / iPadOS では「ホーム画面に追加」で全画面 PWA として動作します。

## 特徴

- **完全静的**: API ルートなし。GitHub Pages / Cloudflare Pages / 任意の静的ホストで動作
- **2 つの再生モードを自動選択**: Mirakurun の TS 直再生と EPGStation 経由の HLS 再生を URL から判定
- **外部アプリ再生**: スマホ・タブレットで VLC / Infuse に渡して再生(ブラウザ再生と並存)。ライブ視聴は VLC 推奨
- **キーボードショートカット**: PC で `↑` `↓` `/` `f` `m` に対応
- **PWA 対応**: iOS / Android / Desktop Chrome でホーム画面から全画面起動
- **設定はローカル保存のみ**: プレイリストや選択チャンネルはブラウザの `localStorage` にのみ保存
- **番組情報(EPG)表示**: 現在放送中の番組名・進捗・あらすじを表示
- **中継サーバなし**: Mirakurun / EPGStation へブラウザから直接通信。Tailscale 等のプライベートネットワーク越しでも動作

## 使い方

1. アプリを開き、右上の歯車アイコンから設定を開く
2. プレイリストの URL を入力して適用する
   - Mirakurun: `https://your-mirakurun/api/iptv/playlist`(TS 直モード)
   - EPGStation: `https://your-epgstation/api/channels`(HLS モード)
3. サイドバーからチャンネルを選んで再生

### 受け付けるフォーマット

読み込めるのは次の 2 種類です。URL タブ・テキストタブ・ファイルタブのどれから入れても内部的には同じ扱いになります。

**1. M3U プレイリスト**(Mirakurun の `/api/iptv/playlist` など)

```
#EXTM3U
#EXTINF:-1 tvg-id="3273601024" group-title="GR",NHK総合
https://your-host/api/services/3273601024/stream
```

必須なのは `#EXTINF:-1 …,チャンネル名` の行と直後の URL 行だけです(`tvg-id` などの属性は任意)。URL が `…/api/streams/live/{id}/hls` 形式なら HLS 再生、それ以外は Mirakurun の TS 直再生に自動判定されます。

**2. EPGStation `/api/channels` の JSON**

```json
[{ "id": 3273601024, "name": "NHK総合", "channelType": "GR" }]
```

テキスト/ファイルで貼り付ける場合は、HLS 起動 URL を組み立てるために **Base URL(EPGStation の URL)が必須**です。URL タブで `/api/channels` を直接指定する場合は不要です。

どちらも **EPGStation / Mirakurun の生の出力をそのまま受け付けます**(mira-web 独自の記法はありません)。EPGStation の `/api/channels` が返す JSON、Mirakurun の `/api/iptv/playlist` が返す標準 M3U を、変換せずコピペ・アップロードできます。設定のエクスポートで書き出す `.m3u` も標準 M3U なので、VLC 等の他アプリでも読めます。

### 設定画面の項目

| 項目 | 説明 |
|---|---|
| URL タブ | m3u または EPGStation `/api/channels` の URL を指定。プリセットが 2 つ以上あるときはドロップダウンで切替 |
| テキストタブ | m3u や EPGStation の channels JSON を直接貼り付け(JSON は自動検出して変換) |
| ファイルタブ | `.m3u` / `.m3u8` / `.json` ファイルをアップロード |
| Base URL | テキスト/ファイル経由時に、m3u 内の `http://` を書き換え、HLS 起動 URL の origin を組み立てる(例: `https://your-epgstation/api/channels`) |
| サブチャンネルを表示 | 地デジのマルチ編成(例: NHK総合2)を一覧に表示する。既定はオフ(各局のメインチャンネルのみ表示) |
| 外部プレイヤー | スマホ・タブレットの「アプリで開く」で使うアプリ。VLC(既定)/ Infuse を切替(Android は VLC 固定)。ライブ TS は VLC のみ対応、Infuse は録画ファイル向け |
| EPGStation 画質モード | 「アプリで開く」で EPGStation を再生するときの画質。EPGStation の `/api/config` から実際のプリセット名を自動取得して表示 |
| キャッシュをクリア | Service Worker と Cache Storage を消去してリロード(プレイリスト設定は維持) |
| 設定を削除 | localStorage のプレイリスト設定を削除 |

## 再生モードと対応ブラウザ

URL のパターンから自動でモードを判定します。

| URL パターン | モード | 復号方式 | 対応ブラウザ |
|---|---|---|---|
| Mirakurun `/api/iptv/playlist` | TS 直([ts-live.js](https://github.com/kounoike/ts-live)) | WebGPU + WebCodecs + WASM | Chrome / Edge 113+ / macOS Safari 18+(WebGPU 必須) |
| EPGStation `/api/channels` | HLS | サーバ側 H.264 トランスコード → ネイティブ HLS / hls.js | iOS / iPadOS Safari, macOS Safari, Chrome / Edge / Firefox |

- **iOS / iPadOS では HLS モードを使う**: WebKit は WebCodecs で MPEG-2 を復号できないため、ブラウザ内での TS 直モードは使えません。iPhone / iPad で Mirakurun を選ぶと「TS 直接再生に対応していません」と案内が出るので、**「アプリで開く」から VLC で再生**するか、EPGStation の HLS ソースをご利用ください
- EPGStation の HLS 配信は **H.264 + AAC で再エンコード**されている必要があります(`config.yml` の `stream` セクションで `-c:v libx264 -c:a aac` 系を指定)
- TS 直モードは `SharedArrayBuffer` を使うため Cross-Origin Isolation(クロスオリジン分離)が必要ですが、同梱の Service Worker(`public/coi-serviceworker.js`)がヘッダを注入するので GitHub Pages でも動作します(WebGPU が無い環境では登録されません)

## サーバ側の準備

ブラウザから直接接続するため、使う再生モードに応じてサーバ側の設定が必要です。

### Mirakurun(TS 直モード)

1. **HTTPS 化**: Pages は HTTPS のため、`http://` のままだと mixed-content(混合コンテンツ)としてブロックされます
   - Tailscale Serve(推奨、Tailscale ネットワーク内のみ): `tailscale serve --bg --https=443 http://localhost:40772`
   - Cloudflare Tunnel、またはリバースプロキシ(Caddy 等)+ Let's Encrypt
2. **`allowOrigins` の追加**(追加後に再起動):

   ```yaml
   # /usr/local/etc/mirakurun/server.yml
   allowOrigins:
     - "https://<your-username>.github.io"
   allowPNA: true
   ```

### EPGStation(HLS モード・EPG パネル使用時)

1. **HTTPS 化**: Mirakurun と同様(Tailscale Serve / Cloudflare Tunnel / リバースプロキシ)
2. **CORS ヘッダ**: EPGStation 自身は CORS を返さないため、Caddy 等のリバースプロキシをサイドカーで立てて
   `Access-Control-Allow-Origin: *` / `Cross-Origin-Resource-Policy: cross-origin` / `Access-Control-Allow-Private-Network: true` を付与し、OPTIONS(preflight = 事前確認リクエスト)には 204 + 同ヘッダを返す

## トラブルシューティング: iPhone で URL モードが失敗する場合

iPhone Safari は iCloud プライベートリレーや Local Network Access の制約により、URL モードの cross-origin fetch が無音で失敗することがあります(iPad / Mac では発生しません)。その場合は次の手順で回避できます。

1. PC 等で `curl https://your-epgstation/api/channels > channels.json` として JSON を取得
2. 設定のテキストタブに貼り付け(またはファイルタブでアップロード)
3. Base URL に EPGStation の URL を入力して適用

Mirakurun の m3u も同じ手順(m3u テキスト貼付 + Base URL に Mirakurun の URL)で再生できます。

## 画面の機能

- **チャンネル名の半角表示**: 放送(ARIB)由来のチャンネル名は Mirakurun / EPGStation とも全角で届くため、フロント側で英数字・記号・空白を半角化して表示する(カナ・漢字は保持。例 `ＮＨＫ総合１・東京` → `NHK総合1・東京`)
- **チャンネル検索(曖昧マッチ)**: 検索ボックスは部分一致に加えて、全角/半角・英字の大小・カタカナ/ひらがなを同一視し、ローマ字入力もかなへ変換して照合する(「あに」「アニ」「ani」いずれでも「BSアニマックス」等に一致)。入力中に現れる `×` ボタンでワンタップ消去
- **EPG パネル**: 再生中チャンネルの番組名・時間・残り時間・進捗バー・あらすじを表示。30 秒ごとに自動更新。EPGStation の `/api/schedules/broadcasting` から取得し、Mirakurun 直モードでもプリセットに EPGStation の URL があればそちらを使用
- **ストリーム情報パネル**: 解像度・ビットレート・コーデック・バッファ・ドロップを表示
- **キーボードショートカット**(PC): `↑` / `↓` で表示中リストのチャンネル送り、`/` で検索ボックスへ、`f` で全画面、`m` でミュート(入力欄にフォーカス中は無効)
- **バージョン表示**: 設定モーダル下部にアプリの版・コミット短縮 SHA・ビルド日を控えめに表示(どのデプロイかを特定できる)
- **外部アプリ再生**: スマホ・タブレットではプレイヤー下に「アプリで開く」を表示。Mirakurun は TS 直 URL を、EPGStation は m2ts 変換 URL を VLC / Infuse に渡す(URL 形式は EPGStation の実装に合わせ、Infuse へは percent-encode せず渡す)。ライブ TS を再生できるのは VLC。デスクトップでは非表示
- **PWA インストール**: iOS Safari は共有ボタン →「ホーム画面に追加」、Android Chrome はメニュー →「ホーム画面に追加」、Desktop Chrome / Edge はアドレスバーのインストールアイコン

## セキュリティ

- 設定(URL / 貼付テキスト / 選択チャンネル)はブラウザの `localStorage` にのみ保存され、リモートへ送信されない
- すべての fetch は `credentials: "omit"` で発行(Cookie を送らない)
- ユーザー入力 URL は `http` / `https` のみに制限
- mixed-content(HTTPS ページからの HTTP fetch)は fetch 前に検出して警告
- リポジトリに `.m3u` ファイルは含めない(`.gitignore` 済み)

## 開発

ローカルで開発サーバを起動するには:

```bash
npm install
npm run dev
# → http://localhost:3000
```

| コマンド | 説明 |
|---|---|
| `npm run dev` | 開発サーバ |
| `npm run build` | 静的書き出し → `out/` |
| `npm run typecheck` | TypeScript 型検査 |
| `npm test` | Vitest ユニットテスト |
| `node scripts/generate-icons.mjs` | PWA アイコンを SVG マスターから再生成(デザイン変更時のみ) |
| `node scripts/viewport-check.mjs` | UI 変更時の全ビューポート表示検証(PC / タブレット / iPhone、最小 320px。要 Playwright。詳細は [`scripts/README.md`](scripts/README.md)) |

## デプロイ(GitHub Pages)

1. リポジトリの Settings → Pages で source を **GitHub Actions** に設定
2. `main` に push すると [`deploy.yml`](.github/workflows/deploy.yml) が型検査・テスト・ビルド・デプロイを実行
3. `https://<user>.github.io/<repo>/` で公開

- **サブパス**: ワークフローが `NEXT_PUBLIC_BASE_PATH=/<repo>` を設定します。ユーザーサイト(`<user>.github.io` 直下)やカスタムドメインでは空文字に上書きしてください
- **他の静的ホスト**: `npm run build` で生成される `out/` をそのままアップロードすれば動作します(サブパス配信時は `NEXT_PUBLIC_BASE_PATH` を調整)
- **プレイリストのプリセット(任意)**: Settings → Secrets and variables → Actions → Variables の `PLAYLIST_PRESETS` に JSON 配列を設定すると URL タブの初期値になります(2 つ以上設定した場合はドロップダウンで切替)

  ```json
  [
    {"name": "EPGStation HLS (iOS OK)", "url": "https://your-epgstation/api/channels"},
    {"name": "Mirakurun (高画質)", "url": "https://your-mirakurun/api/iptv/playlist"}
  ]
  ```

  単一 URL だけなら `DEFAULT_PLAYLIST_URL` でも可(`PLAYLIST_PRESETS` 未設定時に使用)。

  > プリセット URL はビルド成果物に埋め込まれます。Tailscale 等の private network 経由でしか到達できないホストなら公開しても実害はありませんが、public に露出した Mirakurun / EPGStation の URL は登録しないでください。

## 謝辞

- [Mirakurun](https://github.com/Chinachu/Mirakurun) — 日本のテレビ向け DVR チューナーサーバ
- [EPGStation](https://github.com/l3tnun/EPGStation) — Mirakurun 用録画フロントエンド
- [ts-live.js](https://github.com/kounoike/ts-live) — ブラウザ内 MPEG-TS デコーダ
- [hls.js](https://github.com/video-dev/hls.js) — non-Safari ブラウザでの HLS 再生
- [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker) — Cross-Origin Isolation 注入の実装パターン
