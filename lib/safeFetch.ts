/**
 * 任意のユーザー入力 URL を安全に fetch するためのヘルパー。
 *
 * 静的サイト (GitHub Pages) では API プロキシが使えないため、ブラウザから直接
 * Mirakurun サーバーへ接続する。その際にユーザーが貼った URL を最低限バリデート
 * してから扱う。
 */

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export interface ParsedUrl {
  url: URL;
  /** Tailscale 100.64.0.0/10 / RFC1918 / loopback / link-local 等 */
  isPrivateNetwork: boolean;
}

/**
 * 入力 URL を検証して URL オブジェクトを返す。問題があれば例外。
 * セキュリティチェック:
 *   - http/https のみ
 *   - 文字列が URL として valid
 *   - file:/javascript: 等を排除
 */
export function validateUrl(input: string): ParsedUrl {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("URL の形式が正しくありません");
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new Error(`プロトコル ${url.protocol} は許可されていません (http/https のみ)`);
  }
  return { url, isPrivateNetwork: looksPrivate(url.hostname) };
}

/** Tailscale CGNAT / RFC1918 / loopback / link-local っぽいか (best-effort) */
function looksPrivate(hostname: string): boolean {
  if (!hostname) return false;
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h.endsWith(".local") || h.endsWith(".lan") || h.endsWith(".internal")) return true;
  // Tailscale MagicDNS
  if (h.endsWith(".ts.net")) return true;
  // IPv4
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return true;
  // Tailscale CGNAT 100.64.0.0/10
  if (/^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./.test(h)) return true;
  // IPv6 loopback / ULA / link-local
  if (h === "::1" || h === "[::1]") return true;
  if (/^\[?fc/i.test(h) || /^\[?fd/i.test(h)) return true;
  if (/^\[?fe80/i.test(h)) return true;
  return false;
}

/** Mixed-content (https ページから http リソース) のときに早期警告メッセージを返す */
export function mixedContentWarning(url: URL): string | null {
  if (typeof window === "undefined") return null;
  if (window.location.protocol === "https:" && url.protocol === "http:") {
    return (
      "現在のページは HTTPS ですが、指定された URL は HTTP です。" +
      "ブラウザの mixed content ポリシーによりブロックされます。" +
      "Mirakurun を HTTPS で公開してください (Tailscale Funnel / Cloudflare Tunnel / Caddy 等)。"
    );
  }
  return null;
}

/** 静的ホスティング上から Mirakurun へ直接 fetch するときの共通オプション */
export function buildFetchInit(
  url: URL,
  signal?: AbortSignal,
  opts?: { method?: "GET" | "HEAD" }
): RequestInit {
  const init: RequestInit & { targetAddressSpace?: string } = {
    method: opts?.method ?? "GET",
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    redirect: "follow",
    signal,
  };
  // Chrome の Private Network Access — public ページから private host を叩くのに必須。
  // TSPlay と同じヒント。Mirakurun は preflight に応答する。
  if (looksPrivate(url.hostname)) {
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      init.targetAddressSpace = "local";
    } else {
      init.targetAddressSpace = "private";
    }
  }
  return init;
}
