/**
 * PWA / Service Worker 関連のキャッシュをすべて消去するユーティリティ。
 *
 * 消去対象:
 *   - 全 ServiceWorker 登録 (coi-serviceworker 含む)
 *   - 全 Cache Storage エントリ (SW がキャッシュした静的アセット等)
 *
 * 維持されるもの:
 *   - localStorage / sessionStorage (m3u 設定や選択チャンネル)
 *   - IndexedDB
 *   - HTTP browser cache (これは JS から完全消去できない。reload で更新)
 *
 * 呼び出し側はこの関数 await 後に window.location.reload() で
 * クリーンな状態を読み直す想定。
 */
export async function clearAllAppCaches(): Promise<void> {
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    } catch {
      /* registration が取れない環境は無視 */
    }
  }
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
    } catch {
      /* Cache Storage 非対応ブラウザは無視 */
    }
  }
}
