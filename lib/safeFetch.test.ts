import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildFetchInit, mixedContentWarning, validateUrl } from "./safeFetch";

describe("validateUrl", () => {
  it("http / https の URL を受け付ける", () => {
    expect(validateUrl("http://example.com/").url.toString()).toBe("http://example.com/");
    expect(validateUrl("https://example.com/x").url.toString()).toBe("https://example.com/x");
  });

  it("不正な URL を拒否する", () => {
    expect(() => validateUrl("not a url")).toThrow();
    expect(() => validateUrl("")).toThrow();
  });

  it("file: / javascript: / data: スキームを拒否する", () => {
    expect(() => validateUrl("file:///etc/passwd")).toThrow(/プロトコル/);
    expect(() => validateUrl("javascript:alert(1)")).toThrow(/プロトコル/);
    expect(() => validateUrl("data:text/html,<script>")).toThrow(/プロトコル/);
  });

  it("先頭・末尾の空白を許容する", () => {
    expect(validateUrl("  http://example.com/  ").url.host).toBe("example.com");
  });

  describe("private network 判定", () => {
    it("RFC1918 を private 判定", () => {
      expect(validateUrl("http://10.0.0.1/").isPrivateNetwork).toBe(true);
      expect(validateUrl("http://192.168.1.1/").isPrivateNetwork).toBe(true);
      expect(validateUrl("http://172.16.0.1/").isPrivateNetwork).toBe(true);
      expect(validateUrl("http://172.31.0.1/").isPrivateNetwork).toBe(true);
      // 172.32 は範囲外
      expect(validateUrl("http://172.32.0.1/").isPrivateNetwork).toBe(false);
    });

    it("Tailscale CGNAT 100.64.0.0/10 を private 判定", () => {
      expect(validateUrl("http://100.64.0.1/").isPrivateNetwork).toBe(true);
      expect(validateUrl("http://100.127.255.255/").isPrivateNetwork).toBe(true);
      expect(validateUrl("http://100.128.0.1/").isPrivateNetwork).toBe(false);
    });

    it("Tailscale MagicDNS .ts.net を private 判定", () => {
      expect(validateUrl("https://foo.bar.ts.net/").isPrivateNetwork).toBe(true);
    });

    it(".local / .lan / .internal を private 判定", () => {
      expect(validateUrl("http://router.local/").isPrivateNetwork).toBe(true);
      expect(validateUrl("http://nas.lan/").isPrivateNetwork).toBe(true);
      expect(validateUrl("http://api.internal/").isPrivateNetwork).toBe(true);
    });

    it("loopback を private 判定", () => {
      expect(validateUrl("http://127.0.0.1/").isPrivateNetwork).toBe(true);
      expect(validateUrl("http://localhost/").isPrivateNetwork).toBe(true);
    });

    it("public ホストは private でない", () => {
      expect(validateUrl("https://example.com/").isPrivateNetwork).toBe(false);
      expect(validateUrl("https://github.io/").isPrivateNetwork).toBe(false);
      // 100.0/16 は CGNAT 範囲外 (private 判定しない)
      expect(validateUrl("http://100.10.0.1/").isPrivateNetwork).toBe(false);
    });
  });
});

describe("mixedContentWarning", () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow;
    } else {
      // @ts-expect-error - test cleanup
      delete globalThis.window;
    }
  });

  it("https ページから http URL は警告を返す", () => {
    // @ts-expect-error - mock window
    globalThis.window = { location: { protocol: "https:" } };
    const url = new URL("http://example.com/");
    expect(mixedContentWarning(url)).toMatch(/HTTPS/);
  });

  it("https → https は警告なし", () => {
    // @ts-expect-error - mock window
    globalThis.window = { location: { protocol: "https:" } };
    expect(mixedContentWarning(new URL("https://example.com/"))).toBeNull();
  });

  it("http ページから http URL は警告なし", () => {
    // @ts-expect-error - mock window
    globalThis.window = { location: { protocol: "http:" } };
    expect(mixedContentWarning(new URL("http://example.com/"))).toBeNull();
  });

  it("SSR (window 未定義) では null を返す", () => {
    // @ts-expect-error - simulate SSR
    delete globalThis.window;
    expect(mixedContentWarning(new URL("http://example.com/"))).toBeNull();
  });
});

describe("buildFetchInit", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("基本オプションが正しい", () => {
    const init = buildFetchInit(new URL("https://public.example.com/"));
    expect(init.method).toBe("GET");
    expect(init.mode).toBe("cors");
    expect(init.credentials).toBe("omit");
    expect(init.cache).toBe("no-store");
    expect(init.redirect).toBe("follow");
  });

  it("private host には targetAddressSpace=private を付ける", () => {
    const init = buildFetchInit(new URL("https://foo.ts.net/")) as RequestInit & {
      targetAddressSpace?: string;
    };
    expect(init.targetAddressSpace).toBe("private");
  });

  it("localhost / 127.0.0.1 には targetAddressSpace=local を付ける", () => {
    const a = buildFetchInit(new URL("http://localhost:3000/")) as RequestInit & {
      targetAddressSpace?: string;
    };
    expect(a.targetAddressSpace).toBe("local");
    const b = buildFetchInit(new URL("http://127.0.0.1:3000/")) as RequestInit & {
      targetAddressSpace?: string;
    };
    expect(b.targetAddressSpace).toBe("local");
  });

  it("public host には targetAddressSpace を付けない", () => {
    const init = buildFetchInit(new URL("https://example.com/")) as RequestInit & {
      targetAddressSpace?: string;
    };
    expect(init.targetAddressSpace).toBeUndefined();
  });

  it("AbortSignal を渡すと init.signal にセットされる", () => {
    const ac = new AbortController();
    const init = buildFetchInit(new URL("https://example.com/"), ac.signal);
    expect(init.signal).toBe(ac.signal);
  });

  it("HEAD メソッドも指定可能", () => {
    const init = buildFetchInit(new URL("https://example.com/"), undefined, { method: "HEAD" });
    expect(init.method).toBe("HEAD");
  });
});
