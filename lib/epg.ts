/**
 * 現在放送中の番組情報を取得するヘルパー。
 *
 * 主に EPGStation の `/api/schedules/broadcasting?isHalfWidth=true` を利用する。
 * Mirakurun 直モードのチャンネルでも、同じ Tailnet に EPGStation があれば
 * channelId で問い合わせできる (番組情報は EPGStation の DB に蓄積される)。
 *
 * 設計の割り切り:
 *   - チャンネルの URL の origin から EPG をホストするサーバを推定する。
 *     EPGStation HLS URL → そのまま EPGStation
 *     Mirakurun URL     → そのまま Mirakurun (programs API)
 *   - Mirakurun の programs API は今のところ常に空が返ってくるケースもあり、
 *     その場合は番組情報なしとして扱う (panel 側でプレースホルダ)。
 */

import { buildFetchInit, validateUrl } from "./safeFetch";
import type { Channel } from "./types";

export interface CurrentProgram {
  id?: number;
  channelId: number;
  /** 開始 (ms epoch) */
  startAt: number;
  /** 終了 (ms epoch) */
  endAt: number;
  name: string;
  description?: string;
  extended?: string;
  genre1?: number;
}

interface EpgstationBroadcastingItem {
  channel: { id: number; serviceId: number; networkId: number; name: string };
  programs: Array<{
    id?: number;
    channelId: number;
    startAt: number;
    endAt: number;
    name: string;
    description?: string;
    extended?: string;
    genre1?: number;
  }>;
}

/**
 * channel.url の origin (EPGStation でも Mirakurun でも) に対して
 * EPGStation の `/api/schedules/broadcasting` を叩く。EPGStation でない場合は
 * 404 になり null を返す。
 */
export async function fetchCurrentProgram(
  channel: Channel,
  signal?: AbortSignal
): Promise<CurrentProgram | null> {
  const channelIdNum = Number(channel.id);
  if (!Number.isFinite(channelIdNum)) return null;

  let parsed;
  try {
    parsed = validateUrl(channel.url);
  } catch {
    return null;
  }
  const broadcastingUrl = `${parsed.url.origin}/api/schedules/broadcasting?isHalfWidth=true`;

  let res: Response;
  try {
    res = await fetch(broadcastingUrl, buildFetchInit(new URL(broadcastingUrl), signal));
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const items: EpgstationBroadcastingItem[] = await res.json().catch(() => []);
  if (!Array.isArray(items)) return null;

  // 該当 channelId の最初の番組
  const match = items.find((it) => it.channel?.id === channelIdNum);
  const prog = match?.programs?.[0];
  if (!prog) return null;

  return {
    id: prog.id,
    channelId: prog.channelId,
    startAt: prog.startAt,
    endAt: prog.endAt,
    name: prog.name,
    description: prog.description,
    extended: prog.extended,
    genre1: prog.genre1,
  };
}

/** 残り秒数 (負なら 0) */
export function remainingMs(p: CurrentProgram, now = Date.now()): number {
  return Math.max(0, p.endAt - now);
}

/** 番組進捗 0..1 */
export function progressRatio(p: CurrentProgram, now = Date.now()): number {
  const total = p.endAt - p.startAt;
  if (total <= 0) return 0;
  const elapsed = now - p.startAt;
  return Math.max(0, Math.min(1, elapsed / total));
}

/** "19:00" 形式の時刻文字列 */
export function formatHm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "1時間23分" 形式の経過/残り時間 */
export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}時間${m}分`;
  return `${m}分`;
}
