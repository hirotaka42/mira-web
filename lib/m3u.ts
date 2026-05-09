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

export function parseM3u(text: string): Channel[] {
  const lines = text.split(/\r?\n/);
  const channels: Channel[] = [];
  let pending: { name: string; attrs: Record<string, string> } | null = null;

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
      const url = line;
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
