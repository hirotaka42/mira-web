// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import HlsPlayer from "./HlsPlayer";
import type { Channel } from "@/lib/types";

/**
 * HlsPlayer のストリーム孤児化に対する回帰テスト。
 *
 * 修正前コードでは起動 RPC fetch に AbortSignal を渡していたため、
 * アンマウント時に signal が abort されると応答を受け取れず streamId を
 * 確保できない。結果として DELETE が送れずサーバ側にストリームが残る。
 *
 * 修正後コードでは signal を渡さず、応答を必ず受け取ったうえで
 * cancelled フラグを判定し、中断時も fire-and-forget DELETE を送る。
 */

/* ------------------------------------------------------------------ */
/*  helpers                                                           */
/* ------------------------------------------------------------------ */

/** テスト用チャンネル (HLS モード) */
const testChannel: Channel = {
  id: "test-gr-1",
  name: "テストチャンネル",
  group: "GR",
  url: "http://localhost:8888/api/streams/live/GR/hls?mode=0",
  kind: "epgstation-hls",
};

/** streamId を含む起動 RPC の正常応答 */
function okStreamResponse(streamId: number): Response {
  return new Response(JSON.stringify({ streamId }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** 汎用の空 200 応答 */
function emptyOk(): Response {
  return new Response("{}", { status: 200 });
}

/* ------------------------------------------------------------------ */
/*  fetch mock infrastructure                                         */
/* ------------------------------------------------------------------ */

interface DeferredFetch {
  url: string;
  init: RequestInit;
  resolve: (res: Response) => void;
  reject: (err: Error) => void;
}

let fetchLog: Array<{ url: string; init: RequestInit }>;
let deferred: DeferredFetch[];
let originalFetch: typeof globalThis.fetch;

/**
 * fetch モック本体。
 * - 起動 RPC (/api/streams/live/) は手動で解決するまで保留する。
 * - AbortSignal が渡されている場合は abort 時に AbortError で reject する
 *   (修正前コードの挙動を再現するために必須)。
 * - それ以外のリクエスト (keep / DELETE 等) は即座に 200 で返す。
 */
function mockFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
  const opts = init ?? {};
  fetchLog.push({ url: urlStr, init: opts });

  // 起動 RPC — 保留して外部から解決する
  if (urlStr.includes("/api/streams/live/")) {
    return new Promise<Response>((resolve, reject) => {
      const entry: DeferredFetch = { url: urlStr, init: opts, resolve, reject };
      deferred.push(entry);

      // signal が渡されていたら abort を監視 (修正前コードの再現)
      const signal = opts.signal;
      if (signal) {
        if (signal.aborted) {
          reject(new DOMException("The operation was aborted.", "AbortError"));
          return;
        }
        signal.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      }
    });
  }

  // その他 — 即時 200
  return Promise.resolve(emptyOk());
}

/* ------------------------------------------------------------------ */
/*  setup / teardown                                                  */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  fetchLog = [];
  deferred = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(mockFetch) as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/*  Scenario 1: 起動 RPC 応答待ち中にアンマウント → DELETE が送られること */
/* ------------------------------------------------------------------ */

describe("HlsPlayer ストリーム孤児化防止", () => {
  it("起動 RPC 保留中にアンマウント → 応答後に DELETE が送られる", async () => {
    // 1. マウント — 起動 RPC が発行され、保留状態になる
    const { unmount } = render(<HlsPlayer channel={testChannel} />);

    // 起動 RPC の fetch が呼ばれるまで待つ
    await vi.waitFor(() => {
      expect(deferred.length).toBeGreaterThanOrEqual(1);
    });

    // 2. アンマウント (チャンネル切替相当)
    //    修正前: ac.abort() → fetch が AbortError で reject → streamId 未取得 → DELETE 不可
    //    修正後: signal 無し → fetch は保留のまま → cancelled=true
    unmount();

    // 3. 起動 RPC を streamId=42 で解決する
    //    修正前: signal abort 済みなので reject 済み。resolve は無視される。
    //    修正後: resolve が通り、streamId=42 を取得 → cancelled 判定 → DELETE 発射
    const startupEntry = deferred.find((d) => d.url.includes("/api/streams/live/"));
    expect(startupEntry).toBeDefined();
    await act(async () => {
      startupEntry!.resolve(okStreamResponse(42));
      // マイクロタスクを消化して非同期処理を完走させる
      await new Promise((r) => setTimeout(r, 50));
    });

    // 4. DELETE /api/streams/42 が送信されたことをアサート
    const deleteCalls = fetchLog.filter(
      (c) => c.init.method === "DELETE" && c.url.includes("/api/streams/42"),
    );
    expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
  });

  /* ---------------------------------------------------------------- */
  /*  Scenario 2: 正常フロー後のアンマウントで DELETE に keepalive: true */
  /* ---------------------------------------------------------------- */

  it("正常起動後にアンマウント → DELETE が keepalive: true 付きで送られる", async () => {
    // 1. マウント
    const { unmount } = render(<HlsPlayer channel={testChannel} />);

    // 起動 RPC を即座に解決
    await vi.waitFor(() => {
      expect(deferred.length).toBeGreaterThanOrEqual(1);
    });
    const startupEntry = deferred.find((d) => d.url.includes("/api/streams/live/"));
    expect(startupEntry).toBeDefined();

    await act(async () => {
      startupEntry!.resolve(okStreamResponse(99));
      await new Promise((r) => setTimeout(r, 50));
    });

    // 2. アンマウント — cleanup の DELETE が走る
    unmount();

    // マイクロタスクを消化
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // 3. DELETE /api/streams/99 が keepalive: true 付きで送信されたことをアサート
    const deleteCalls = fetchLog.filter(
      (c) => c.init.method === "DELETE" && c.url.includes("/api/streams/99"),
    );
    expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
    expect(deleteCalls.some((c) => (c.init as RequestInit & { keepalive?: boolean }).keepalive === true)).toBe(true);
  });
});
