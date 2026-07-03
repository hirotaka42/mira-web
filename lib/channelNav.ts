import { groupChannels } from "./m3u";
import { filterSubChannels } from "./subchannel";
import type { Channel } from "./types";

/** Sidebar の表示順と同一の平坦リスト (サブch フィルタ → 検索 → グループ順) */
export function visibleChannels(
  channels: Channel[],
  search: string,
  showSubChannels: boolean
): Channel[] {
  const base = showSubChannels ? channels : filterSubChannels(channels);
  const q = search.trim().toLowerCase();
  const filtered = q
    ? base.filter((c) => c.name.toLowerCase().includes(q))
    : base;
  return Array.from(groupChannels(filtered).values()).flat();
}

/** 現在 ID から delta (+1/-1) 移動した ID。currentId がリスト外/未選択なら先頭、空リストなら null。端では留まる。 */
export function adjacentChannelId(
  list: Channel[],
  currentId: string | null,
  delta: 1 | -1
): string | null {
  if (list.length === 0) return null;
  if (currentId === null) return list[0].id;
  const idx = list.findIndex((c) => c.id === currentId);
  if (idx < 0) return list[0].id;
  const next = idx + delta;
  if (next < 0 || next >= list.length) return currentId;
  return list[next].id;
}
