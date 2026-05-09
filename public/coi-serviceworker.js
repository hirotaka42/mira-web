/*!
 * COI Service Worker — Cross-Origin Isolation enabler
 *
 * GitHub Pages のような HTTP ヘッダ追加できないホストで、SharedArrayBuffer に
 * 必要な COOP/COEP ヘッダを Service Worker レイヤで付与するための仕組み。
 *
 * 出典: gzuidhof/coi-serviceworker (MIT) を参考に必要最小限を書き直したもの。
 *   https://github.com/gzuidhof/coi-serviceworker
 *
 * 動作:
 *   1) このファイルを <script src="coi-serviceworker.js"> として読むと、
 *      自身を Service Worker として登録する。
 *   2) 登録直後は controller が無いのでページをリロードする。
 *   3) リロード後、SW が fetch を横取りして COOP=same-origin / COEP=require-corp /
 *      Cross-Origin-Resource-Policy=same-origin を付与する。
 *
 * これで window.crossOriginIsolated === true になり、SharedArrayBuffer が解禁される。
 */

(function coiServiceworker() {
  // ============== Service Worker scope ==============
  if (typeof self === "object" && "ServiceWorkerGlobalScope" in self &&
      self instanceof self.ServiceWorkerGlobalScope) {

    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => {
      event.waitUntil(self.clients.claim());
    });

    self.addEventListener("fetch", (event) => {
      const request = event.request;

      // only-if-cached の cross-origin はそのまま (Chrome の制約)
      if (request.cache === "only-if-cached" && request.mode !== "same-origin") {
        return;
      }

      // ★ 重要: cross-origin fetch は intercept しない。理由:
      // 1) Chrome の Local Network Access (LNA) はユーザー許可プロンプトが必要だが、
      //    SW コンテキスト内の fetch では UI が出せず即拒否される。
      // 2) 同一オリジン (HTML/JS/WASM) に COOP/COEP/CORP を付与できれば
      //    crossOriginIsolated は成立する。cross-origin の応答は
      //    CORP ヘッダ (Mirakurun は `cross-origin` を返す) で COEP を満たす。
      let requestUrl;
      try {
        requestUrl = new URL(request.url);
      } catch {
        return; // 不正な URL は素通し
      }
      if (requestUrl.origin !== self.location.origin) {
        return; // ブラウザのネイティブ fetch に任せる
      }

      event.respondWith(
        fetch(request)
          .then((response) => {
            if (response.status === 0) return response;
            const headers = new Headers(response.headers);
            headers.set("Cross-Origin-Embedder-Policy", "require-corp");
            headers.set("Cross-Origin-Opener-Policy", "same-origin");
            if (!headers.has("Cross-Origin-Resource-Policy")) {
              headers.set("Cross-Origin-Resource-Policy", "same-origin");
            }
            return new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers,
            });
          })
          .catch((err) => {
            console.error("[coi-sw] same-origin fetch failed", err);
            // ここで 502 を返すと「サーバが 502 を返した」ように見えるので
            // 元のエラーを再現する: undefined を返すと event.respondWith が
            // 失敗してデフォルト動作 (ネットワーク失敗) になる
            throw err;
          })
      );
    });

    return;
  }

  // ============== Page scope (registration) ==============
  if (typeof window === "undefined") return;

  const RELOAD_FLAG = "__coi_sw_reloaded__";

  if (window.crossOriginIsolated) {
    // 成功状態 — 次回失敗時に再度 1 回だけリロードできるようにフラグをクリア
    try { window.sessionStorage.removeItem(RELOAD_FLAG); } catch {}
    return;
  }
  if (!window.isSecureContext) {
    console.warn("[coi-sw] Not a secure context — SW registration skipped.");
    return;
  }
  if (!("serviceWorker" in navigator)) {
    console.warn("[coi-sw] Service Workers unavailable — SharedArrayBuffer disabled.");
    return;
  }

  // 1 セッションで 1 回までのリロードに制限 (無限ループ防止)
  function reloadOnce() {
    try {
      if (window.sessionStorage.getItem(RELOAD_FLAG)) {
        console.warn(
          "[coi-sw] crossOriginIsolated could not be enabled after one reload. " +
          "Check Network tab for missing COOP/COEP headers."
        );
        return;
      }
      window.sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
    } catch {}
    window.location.reload();
  }

  const scriptEl = document.currentScript;
  const swUrl = scriptEl ? scriptEl.src : "/coi-serviceworker.js";

  navigator.serviceWorker
    .register(swUrl, { scope: "./" })
    .then((reg) => {
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "activated" && !window.crossOriginIsolated) {
            reloadOnce();
          }
        });
      });
      // 既に active で controller が無い → 1 回だけリロードして isolated 化
      if (reg.active && !navigator.serviceWorker.controller) {
        reloadOnce();
      }
    })
    .catch((err) => {
      console.error("[coi-sw] registration failed", err);
    });
})();
