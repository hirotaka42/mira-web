/**
 * 現在放送中の番組情報を取得するヘルパー。
 *
 * **EPG の唯一のソースは EPGStation** とする (Mirakurun は TS 配信専用)。
 *   - エンドポイント: `/api/schedules/broadcasting?isHalfWidth=true`
 *   - origin の決定:
 *     - epgstation-hls チャンネル → channel.url の origin (= EPGStation 自身)
 *     - mirakurun-mpegts チャンネル → PLAYLIST_PRESETS から
 *       EPGStation の URL を自動検出して使う (presets.getEpgstationOrigin)
 *   - EPGStation の URL がプリセットに無ければ EPG は取れず null を返す
 *     (パネル側でプレースホルダ表示)。
 */

import { buildFetchInit, validateUrl } from "./safeFetch";
import { getEpgstationOrigin } from "./presets";
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
 * EPG 取得用の EPGStation origin を決定する。
 *   - epgstation-hls チャンネル → channel.url の origin
 *   - mirakurun-mpegts チャンネル → PLAYLIST_PRESETS から自動検出
 */
function resolveEpgOrigin(channel: Channel): string | null {
  if (channel.kind === "epgstation-hls") {
    try {
      return validateUrl(channel.url).url.origin;
    } catch {
      return null;
    }
  }
  // Mirakurun mode: presets から EPGStation を探す
  return getEpgstationOrigin();
}

/**
 * EPGStation の `/api/schedules/broadcasting?isHalfWidth=true` を叩いて
 * 該当 channelId の現在番組を返す。EPGStation の URL が分からなければ null。
 */
export async function fetchCurrentProgram(
  channel: Channel,
  signal?: AbortSignal
): Promise<CurrentProgram | null> {
  const channelIdNum = Number(channel.id);
  if (!Number.isFinite(channelIdNum)) return null;

  const origin = resolveEpgOrigin(channel);
  if (!origin) return null;

  const broadcastingUrl = `${origin}/api/schedules/broadcasting?isHalfWidth=true`;

  let res: Response;
  try {
    res = await fetch(broadcastingUrl, buildFetchInit(new URL(broadcastingUrl), signal));
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const items: EpgstationBroadcastingItem[] = await res.json().catch(() => []);
  if (!Array.isArray(items)) return null;

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
