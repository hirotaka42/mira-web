/**
 * プレイリスト URL のプリセットを CI 経由の環境変数から取得する。
 *
 * 優先順:
 *   1. NEXT_PUBLIC_PLAYLIST_PRESETS  (JSON: [{name,url}, ...])
 *   2. NEXT_PUBLIC_DEFAULT_PLAYLIST_URL  (単一 URL のみ。後方互換)
 *
 * 双方未設定なら空配列。
 */

export interface PlaylistPreset {
  name: string;
  url: string;
}

let cached: PlaylistPreset[] | null = null;

export function getPlaylistPresets(): PlaylistPreset[] {
  if (cached) return cached;
  const list: PlaylistPreset[] = [];

  const raw = process.env.NEXT_PUBLIC_PLAYLIST_PRESETS;
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (
            item &&
            typeof item === "object" &&
            typeof (item as PlaylistPreset).url === "string" &&
            typeof (item as PlaylistPreset).name === "string" &&
            (item as PlaylistPreset).url.trim() !== ""
          ) {
            list.push({
              name: (item as PlaylistPreset).name.trim(),
              url: (item as PlaylistPreset).url.trim(),
            });
          }
        }
      }
    } catch {
      // 不正な JSON は無視
    }
  }

  if (list.length === 0) {
    const fallback = process.env.NEXT_PUBLIC_DEFAULT_PLAYLIST_URL;
    if (fallback && fallback.trim() !== "") {
      list.push({ name: "Default", url: fallback.trim() });
    }
  }

  cached = list;
  return list;
}

/** 既定で URL タブにプリフィルする URL (1番目のプリセット or 空) */
export function getDefaultPresetUrl(): string {
  const presets = getPlaylistPresets();
  return presets[0]?.url ?? "";
}

/**
 * 番組情報 (EPG) の取得元として使う EPGStation の origin を、プリセット URL の
 * パターンから自動検出する。
 *
 * 検出ロジック:
 *   - URL pathname が `/api/channels` / `/api/streams/live/...` / `/api/iptv/channel.m3u8`
 *     のいずれかにマッチすれば EPGStation 由来と判定 → その origin を返す
 *   - 該当が無ければ null
 *
 * これで Mirakurun 直モードのチャンネルでも、PLAYLIST_PRESETS に EPGStation の
 * URL が登録されていれば EPG をそちらから取得できる。
 */
export function getEpgstationOrigin(): string | null {
  for (const p of getPlaylistPresets()) {
    try {
      const u = new URL(p.url);
      if (
        /\/api\/channels\/?$/.test(u.pathname) ||
        /\/api\/streams\/live\//.test(u.pathname) ||
        /\/api\/iptv\/channel\.m3u8$/.test(u.pathname)
      ) {
        return u.origin;
      }
    } catch {
      /* invalid url, skip */
    }
  }
  return null;
}
