"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Channel, M3uSource } from "./types";
import { parseM3u } from "./m3u";
import { buildFetchInit, mixedContentWarning, validateUrl } from "./safeFetch";

interface State {
  source: M3uSource | null;
  channels: Channel[];
  selectedId: string | null;
  sidebarCollapsed: boolean;
  search: string;
  loading: boolean;
  error: string | null;

  setSource: (src: M3uSource) => Promise<void>;
  setSearch: (s: string) => void;
  toggleSidebar: () => void;
  selectChannel: (id: string) => void;
  reload: () => Promise<void>;
  clear: () => void;
}

/** m3u 取得結果 + scheme リライト用の base URL を一緒に返す */
async function loadFromSource(
  src: M3uSource
): Promise<{ text: string; baseUrl?: URL }> {
  if (src.kind === "text") return { text: src.value };

  // 静的サイトなのでブラウザから直接 Mirakurun を叩く。
  // Mirakurun 側で allowOrigins にこのオリジンを追加してもらう必要あり。
  const { url } = validateUrl(src.value);
  const warn = mixedContentWarning(url);
  if (warn) throw new Error(warn);

  const res = await fetch(url.toString(), buildFetchInit(url));
  if (!res.ok) {
    throw new Error(`m3u 取得失敗 (${res.status} ${res.statusText})`);
  }
  return { text: await res.text(), baseUrl: url };
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      source: null,
      channels: [],
      selectedId: null,
      sidebarCollapsed: false,
      search: "",
      loading: false,
      error: null,

      setSource: async (src) => {
        set({ loading: true, error: null });
        try {
          const { text, baseUrl } = await loadFromSource(src);
          // baseUrl が与えられた場合は同一ホストのチャンネル URL を base の
          // scheme (https 等) にリライト → mixed-content 回避
          const channels = parseM3u(text, baseUrl);
          if (channels.length === 0) {
            throw new Error("チャンネルが見つかりませんでした (m3u 形式を確認してください)");
          }
          const prev = get().selectedId;
          const stillExists = prev && channels.some((c) => c.id === prev);
          set({
            source: { ...src, fetchedAt: Date.now() },
            channels,
            selectedId: stillExists ? prev : channels[0]?.id ?? null,
            loading: false,
            error: null,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // 典型的な失敗の親切メッセージ
          const friendly = msg.includes("Failed to fetch")
            ? `${msg} — Mirakurun 側で allowOrigins にこのページの origin を許可してください`
            : msg;
          set({ loading: false, error: friendly });
          throw new Error(friendly);
        }
      },

      setSearch: (s) => set({ search: s }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      selectChannel: (id) => set({ selectedId: id }),

      reload: async () => {
        const src = get().source;
        if (!src) return;
        await get().setSource(src);
      },

      clear: () =>
        set({
          source: null,
          channels: [],
          selectedId: null,
          error: null,
        }),
    }),
    {
      name: "mira-web",
      partialize: (s) => ({
        source: s.source,
        selectedId: s.selectedId,
        sidebarCollapsed: s.sidebarCollapsed,
      }),
    }
  )
);

export function useSelectedChannel(): Channel | null {
  return useStore((s) => s.channels.find((c) => c.id === s.selectedId) ?? null);
}
