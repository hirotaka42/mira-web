import type { Channel } from "./types";

/**
 * Mirakurun / EPGStation 共通の数値チャンネル ID
 * (ServiceItem ID = networkId * 100000 + serviceId) を分解する。
 * 数値でない・100000 未満の ID は判定不能として null を返す。
 */
export function decodeServiceRef(
  ch: Channel
): { networkId: number; serviceId: number } | null {
  const raw = ch.tvgId ?? ch.id;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 100000) return null;
  return { networkId: Math.floor(n / 100000), serviceId: n % 100000 };
}

/**
 * サブチャンネル (地デジのマルチ編成) を除外した一覧を返す。
 * - 対象は group === "GR" のみ。地デジは 1 networkId = 1 放送局なので
 *   「同一 networkId 内で serviceId 最小」をメインチャンネルとする
 *   (例: NHK総合1=1024 がメイン、NHK総合2=1025 がサブ)。
 * - BS/CS は networkId が局単位でなく、serviceId の近さ=マルチ編成とも
 *   限らない (WOWOW 191/192/193 等は別チャンネル) ため対象外。
 * - ID が分解できないチャンネルは常に表示 (隠しすぎない方向に倒す)。
 * 元の並び順は保持する。純粋な表示フィルタで入力配列は変更しない。
 */
export function filterSubChannels(channels: Channel[]): Channel[] {
  const minByNetwork = new Map<number, number>();
  for (const ch of channels) {
    if (ch.group !== "GR") continue;
    const ref = decodeServiceRef(ch);
    if (!ref) continue;
    const cur = minByNetwork.get(ref.networkId);
    if (cur === undefined || ref.serviceId < cur) {
      minByNetwork.set(ref.networkId, ref.serviceId);
    }
  }
  return channels.filter((ch) => {
    if (ch.group !== "GR") return true;
    const ref = decodeServiceRef(ch);
    if (!ref) return true;
    return minByNetwork.get(ref.networkId) === ref.serviceId;
  });
}
