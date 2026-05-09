/**
 * EPGStation 連携ヘルパー。
 *
 * EPGStation の `/api/iptv/channel.m3u8` は m2ts URL 固定の m3u を返すため、
 * iOS ブラウザで再生したい場合は HLS が必要。本モジュールでは `/api/channels`
 * (チャンネル一覧 JSON) を読んで、HLS 起動 RPC URL を含む m3u を組み立てる。
 *
 * ユーザーは設定モーダルの URL に
 *   https://<epgstation>/api/channels
 * を入れるだけで iOS 互換モードになる。
 */

export interface EpgstationChannel {
  id: number;
  serviceId?: number;
  networkId?: number;
  name?: string;
  halfWidthName?: string;
  channelType?: string; // "GR" | "BS" | "CS" | "SKY"
  channel?: string;
  hasLogoData?: boolean;
  type?: number;
  remoteControlKeyId?: number;
}

/** 設定 URL が EPGStation の channels API か判定 */
export function isEpgstationChannelsUrl(url: URL): boolean {
  return /\/api\/channels\/?$/.test(url.pathname);
}

const GROUP_RANK: Record<string, number> = { GR: 0, BS: 1, CS: 2, SKY: 3 };

/**
 * EPGStation /api/channels の JSON 配列から HLS 起動 URL 入りの m3u 文字列を作る。
 *
 * @param channels  /api/channels が返す配列
 * @param baseUrl   API を叩いたときの URL (origin から逆算する)
 * @param mode      EPGStation の Stream mode (default 0)
 */
export function buildHlsM3u(
  channels: EpgstationChannel[],
  baseUrl: URL,
  mode: number = 0
): string {
  const origin = baseUrl.origin;
  const sorted = [...channels].sort((a, b) => {
    const ra = GROUP_RANK[a.channelType ?? ""] ?? 9;
    const rb = GROUP_RANK[b.channelType ?? ""] ?? 9;
    if (ra !== rb) return ra - rb;
    if ((a.channel ?? "") !== (b.channel ?? "")) {
      return (a.channel ?? "").localeCompare(b.channel ?? "");
    }
    return (a.serviceId ?? 0) - (b.serviceId ?? 0);
  });

  const out: string[] = ["#EXTM3U"];
  for (const c of sorted) {
    const id = c.id;
    const name = (c.name ?? c.halfWidthName ?? `ch-${id}`).trim();
    const group = c.channelType ?? "OTHER";
    const logo = c.hasLogoData ? `${origin}/api/channels/${id}/logo` : "";
    const attrs = [
      `tvg-id="${id}"`,
      logo ? `tvg-logo="${logo}"` : "",
      `group-title="${group}"`,
    ]
      .filter(Boolean)
      .join(" ");
    out.push(`#EXTINF:-1 ${attrs},${name}`);
    out.push(`${origin}/api/streams/live/${id}/hls?mode=${mode}`);
  }
  return out.join("\n") + "\n";
}
