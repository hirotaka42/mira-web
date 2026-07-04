"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Channel, M3uSource } from "./types";
import type { ExternalPlayerKind } from "./externalPlayer";
import { parseM3u } from "./m3u";
import { buildFetchInit, mixedContentWarning, validateUrl } from "./safeFetch";
import {
  buildHlsM3u,
  isEpgstationChannelsUrl,
  looksLikeEpgstationChannels,
  type EpgstationChannel,
} from "./epgstation";
import { parseSettingsFile } from "./settingsFile";

interface State {
  source: M3uSource | null;
  channels: Channel[];
  selectedId: string | null;
  sidebarCollapsed: boolean;
  showSubChannels: boolean;
  externalPlayer: ExternalPlayerKind;
  externalM2tsMode: number;
  search: string;
  loading: boolean;
  error: string | null;

  /** localStorage からの hydrate が完了したか (UI 初期表示の制御に使う) */
  _hydrated: boolean;
  _markHydrated: () => void;

  setSource: (src: M3uSource) => Promise<void>;
  setSearch: (s: string) => void;
  toggleSidebar: () => void;
  setShowSubChannels: (v: boolean) => void;
  setExternalPlayer: (v: ExternalPlayerKind) => void;
  setExternalM2tsMode: (v: number) => void;
  selectChannel: (id: string) => void;
  deselect: () => void;
  reload: () => Promise<void>;
  clear: () => void;
}

/** m3u 取得結果 + scheme リライト用の base URL を一緒に返す */
async function loadFromSource(
  src: M3uSource
): Promise<{ text: string; baseUrl?: URL }> {
  if (src.kind === "text") {
    // テキスト or ファイル経由の m3u は fetch URL が無いので、ユーザが指定した
    // baseUrl があればそれを使ってチャンネル URL の scheme/host を書き換える。
    // Mirakurun の m3u は内部の http:// が埋まるため、HTTPS ページから扱うには
    // ここで base を当てて https に揃える必要がある。
    let baseUrl: URL | undefined;
    if (src.baseUrl) {
      try {
        baseUrl = new URL(src.baseUrl);
      } catch {
        // 不正な base URL は無視 (rewrite 無し動作にフォールバック)
      }
    }

    // EPGStation の /api/channels が返す JSON を貼付/アップロードしたケースを検出。
    // m3u ではないので parseM3u を通すと 0 件になる。HLS 起動 RPC URL を組み立てる
    // のに origin が必須なので baseUrl 無しでは扱えない。
    const trimmed = src.value.trimStart();
    if (trimmed.startsWith("[")) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(src.value);
      } catch {
        parsed = null;
      }
      if (Array.isArray(parsed) && looksLikeEpgstationChannels(parsed)) {
        if (!baseUrl) {
          throw new Error(
            "EPGStation の channels JSON を検出しましたが、HLS 起動 URL を組み立てる Base URL が必要です。Base URL 欄に EPGStation の URL (例: https://your-epgstation) を入れてください。"
          );
        }
        return {
          text: buildHlsM3u(parsed as EpgstationChannel[], baseUrl),
          baseUrl,
        };
      }
    }

    return { text: src.value, baseUrl };
  }

  // 静的サイトなのでブラウザから直接 Mirakurun / EPGStation を叩く。
  // 各サーバ側で allowOrigins / CORS にこのオリジンを許可しておく必要あり。
  const { url } = validateUrl(src.value);
  const warn = mixedContentWarning(url);
  if (warn) throw new Error(warn);

  const res = await fetch(url.toString(), buildFetchInit(url));
  if (!res.ok) {
    throw new Error(`m3u 取得失敗 (${res.status} ${res.statusText})`);
  }

  // EPGStation の /api/channels (JSON) を入れた場合は HLS 起動 URL の m3u に変換。
  // これで iOS 互換ルートに乗る。
  if (isEpgstationChannelsUrl(url)) {
    const json = (await res.json()) as EpgstationChannel[];
    if (!Array.isArray(json)) {
      throw new Error("/api/channels の応答が配列ではありません");
    }
    return { text: buildHlsM3u(json, url), baseUrl: url };
  }

  // 通常の m3u (Mirakurun / EPGStation の /api/iptv/channel.m3u8 等)
  return { text: await res.text(), baseUrl: url };
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      source: null,
      channels: [],
      selectedId: null,
      sidebarCollapsed: false,
      showSubChannels: false,
      externalPlayer: "infuse" as ExternalPlayerKind,
      externalM2tsMode: 0,
      search: "",
      loading: false,
      error: null,
      _hydrated: false,
      _markHydrated: () => set({ _hydrated: true }),

      setSource: async (src) => {
        set({ loading: true, error: null });
        try {
          // 設定ファイル (mira-web-settings JSON) の検出 — 1 段のみ
          if (src.kind === "text") {
            const sf = parseSettingsFile(src.value);
            if (sf) {
              // 埋め込みの settings を store に適用
              const patch: Partial<State> = {};
              if (sf.settings.showSubChannels !== undefined)
                patch.showSubChannels = sf.settings.showSubChannels;
              if (sf.settings.externalPlayer !== undefined)
                patch.externalPlayer = sf.settings.externalPlayer;
              if (sf.settings.externalM2tsMode !== undefined)
                patch.externalM2tsMode = sf.settings.externalM2tsMode;
              if (Object.keys(patch).length > 0) set(patch);
              // 埋め込み source で通常ロードを続行(再帰しない)
              const innerSrc: M3uSource = {
                kind: sf.source.kind,
                value: sf.source.value,
                ...(sf.source.baseUrl ? { baseUrl: sf.source.baseUrl } : {}),
              };
              const { text, baseUrl } = await loadFromSource(innerSrc);
              const channels = parseM3u(text, baseUrl);
              if (channels.length === 0) {
                let hint = "";
                const firstLine = text.trimStart().split(/\r?\n/)[0] ?? "";
                if (firstLine.startsWith("<")) {
                  hint =
                    " (取得した内容が HTML のようです。URL がプレイリストではなく Web ページを返している可能性があります)";
                }
                throw new Error(
                  `チャンネルが見つかりませんでした (m3u 形式を確認してください)${hint}`
                );
              }
              const prev = get().selectedId;
              const stillExists =
                prev && channels.some((c) => c.id === prev);
              set({
                source: { ...innerSrc, fetchedAt: Date.now() },
                channels,
                selectedId: stillExists ? prev : channels[0]?.id ?? null,
                loading: false,
                error: null,
              });
              return;
            }
          }
          const { text, baseUrl } = await loadFromSource(src);
          // baseUrl が与えられた場合は同一ホストのチャンネル URL を base の
          // scheme (https 等) にリライト → mixed-content 回避
          const channels = parseM3u(text, baseUrl);
          if (channels.length === 0) {
            let hint = "";
            const firstLine = text.trimStart().split(/\r?\n/)[0] ?? "";
            if (firstLine.startsWith("<")) {
              hint =
                " (取得した内容が HTML のようです。URL がプレイリストではなく Web ページを返している可能性があります)";
            }
            throw new Error(
              `チャンネルが見つかりませんでした (m3u 形式を確認してください)${hint}`
            );
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
            ? `${msg} — サーバ側で CORS allowOrigins にこのページの origin を許可してください`
            : msg;
          set({ loading: false, error: friendly });
          throw new Error(friendly);
        }
      },

      setSearch: (s) => set({ search: s }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setShowSubChannels: (v) => set({ showSubChannels: v }),
      setExternalPlayer: (v) => set({ externalPlayer: v }),
      setExternalM2tsMode: (v) => set({ externalM2tsMode: v }),
      selectChannel: (id) => set({ selectedId: id }),
      deselect: () => set({ selectedId: null }),

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
        showSubChannels: s.showSubChannels,
        externalPlayer: s.externalPlayer,
        externalM2tsMode: s.externalM2tsMode,
      }),
      // localStorage から restore 完了を待ってから初回 UI 判断するためのフラグ。
      // SSG/Static Export で稀にあるレース (useEffect が hydrate より早く走る) を防ぐ。
      onRehydrateStorage: () => (state) => {
        // hydrate 成功時にフラグ立て (失敗時 state は undefined)
        state?._markHydrated();
      },
    }
  )
);

export function useSelectedChannel(): Channel | null {
  return useStore((s) => s.channels.find((c) => c.id === s.selectedId) ?? null);
}
