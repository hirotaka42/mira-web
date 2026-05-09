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
      event.respondWith(
        fetch(request)
          .then((response) => {
            if (response.status === 0) return response;
            const headers = new Headers(response.headers);
            headers.set("Cross-Origin-Embedder-Policy", "require-corp");
            headers.set("Cross-Origin-Opener-Policy", "same-origin");
            // 静的アセット (同一オリジン) には CORP も付ける
            if (
              new URL(request.url).origin === self.location.origin &&
              !headers.has("Cross-Origin-Resource-Policy")
            ) {
              headers.set("Cross-Origin-Resource-Policy", "same-origin");
            }
            return new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers,
            });
          })
          .catch((err) => {
            console.error("[coi-sw] fetch failed", err);
            return new Response("", { status: 502, statusText: "fetch failed" });
          })
      );
    });

    return;
  }

  // ============== Page scope (registration) ==============
  if (typeof window === "undefined") return;
  if (window.crossOriginIsolated) return; // 既に isolated → 何もしない
  if (!window.isSecureContext) {
    console.warn("[coi-sw] Not a secure context — SW registration skipped.");
    return;
  }
  if (!("serviceWorker" in navigator)) {
    console.warn("[coi-sw] Service Workers unavailable — SharedArrayBuffer disabled.");
    return;
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
            window.location.reload();
          }
        });
      });
      // 既に active で controller が無い → 1 回だけリロードして isolated 化
      if (reg.active && !navigator.serviceWorker.controller) {
        window.location.reload();
      }
    })
    .catch((err) => {
      console.error("[coi-sw] registration failed", err);
    });
})();
