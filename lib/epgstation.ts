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

/**
 * 任意の値が EPGStation の channels JSON 配列っぽいか判定。
 * テキスト貼付/ファイルアップロード時に m3u か EPGStation JSON かを切り分けるのに使う。
 *
 * 緩く判定する: 空配列なら false、先頭要素が { id: number } を持っていれば true。
 * (Mirakurun の serviceの JSON も id を持つが、Mirakurun の `/api/services` 等は
 *  そのまま静的視聴用にできない別物なのでここでは EPGStation 用と扱う。)
 */
export function looksLikeEpgstationChannels(arr: unknown[]): boolean {
  if (arr.length === 0) return false;
  const first = arr[0];
  if (!first || typeof first !== "object") return false;
  const obj = first as Record<string, unknown>;
  if (typeof obj.id !== "number") return false;
  // name または halfWidthName または channel 何かは通常入っている
  return (
    typeof obj.name === "string" ||
    typeof obj.halfWidthName === "string" ||
    typeof obj.channel === "string"
  );
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
