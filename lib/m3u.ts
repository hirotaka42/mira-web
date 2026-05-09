import type { Channel } from "./types";

const EXTINF_RE = /^#EXTINF:-?\d+(?:\.\d+)?(.*?),(.*)$/;
const ATTR_RE = /([\w-]+)="([^"]*)"/g;

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(s))) {
    out[m[1]] = m[2];
  }
  return out;
}

/**
 * m3u を Channel[] にパースする。
 *
 * @param text       m3u 全文
 * @param baseUrl    プレイリストを取得した URL。指定するとチャンネル URL を
 *                   その scheme/host にリライトする (Mirakurun は `req.protocol`
 *                   を使って m3u 内 URL を生成するため、リバースプロキシ越しでは
 *                   常に `http://` になってしまう。HTTPS の page から取得した
 *                   ときは scheme を揃えないと mixed-content でブロックされる)。
 */
export function parseM3u(text: string, baseUrl?: string | URL): Channel[] {
  const lines = text.split(/\r?\n/);
  const channels: Channel[] = [];
  let pending: { name: string; attrs: Record<string, string> } | null = null;

  let base: URL | null = null;
  if (baseUrl) {
    try {
      base = baseUrl instanceof URL ? baseUrl : new URL(baseUrl);
    } catch {
      base = null;
    }
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#KODIPROP") || line === "#EXTM3U") continue;

    if (line.startsWith("#EXTINF:")) {
      const m = line.match(EXTINF_RE);
      if (!m) continue;
      const attrs = parseAttrs(m[1]);
      const name = m[2].trim();
      pending = { name, attrs };
      continue;
    }

    if (line.startsWith("#")) continue;

    if (pending) {
      const url = base ? rewriteUrl(line, base) : line;
      const id = pending.attrs["tvg-id"] || extractIdFromUrl(url) || url;
      channels.push({
        id,
        name: pending.name,
        group: pending.attrs["group-title"] || "OTHER",
        url,
        tvgId: pending.attrs["tvg-id"],
        logo: pending.attrs["tvg-logo"],
      });
      pending = null;
    }
  }

  return channels;
}

/**
 * m3u 内の URL を base URL の scheme/host に揃える。
 *   - 同一 hostname (= base と同じサーバ) のときだけ scheme/host をリライト
 *   - 別ホスト (CDN など) はそのまま
 *   - 不正な URL ならそのまま
 */
function rewriteUrl(url: string, base: URL): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.hostname !== base.hostname) return url;
  // 同一ホスト → scheme/host/port を base のものに揃える。
  // pathname/search/hash は元 URL のものを保持。
  // (URL.host や URL.protocol セッターには順序依存の罠があるので、
  //  pathname を base に対して相対解決する方が確実)
  return new URL(
    parsed.pathname + parsed.search + parsed.hash,
    base.origin + "/"
  ).toString();
}

function extractIdFromUrl(url: string): string | null {
  const m = url.match(/\/services\/(\d+)\//);
  return m ? m[1] : null;
}

export function groupChannels(channels: Channel[]): Map<string, Channel[]> {
  const map = new Map<string, Channel[]>();
  for (const ch of channels) {
    const arr = map.get(ch.group) ?? [];
    arr.push(ch);
    map.set(ch.group, arr);
  }
  return map;
}
