"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";
import TsLivePlayer from "@/components/TsLivePlayer";
import HlsPlayer from "@/components/HlsPlayer";
import EpgPanel from "@/components/EpgPanel";
import StatsPanel from "@/components/StatsPanel";
import SettingsModal from "@/components/SettingsModal";
import { useStore, useSelectedChannel } from "@/lib/store";
import type { PlaybackStats } from "@/lib/types";

export default function Page() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stats, setStats] = useState<PlaybackStats>({});
  const hydrated = useStore((s) => s._hydrated);
  const hasSource = useStore((s) => !!s.source);
  const channels = useStore((s) => s.channels);
  const reload = useStore((s) => s.reload);
  const selected = useSelectedChannel();

  // 初回ロード: localStorage の hydrate 完了を待ってから判断する
  //   - hydrate 後に source が残っていれば再取得 (= モーダル開かない)
  //   - 何もなければ設定モーダルを開く
  // hydrate 待ちにしないと、SSG/CSR の境目で「hydrate 前に modal を開く」
  // 不具合が出ることがある (リロード後に毎回 modal が出る現象)。
  useEffect(() => {
    if (!hydrated) return;
    if (hasSource && channels.length === 0) {
      reload().catch(() => {});
      return;
    }
    if (!hasSource) {
      setSettingsOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // チャンネル切替時 + ソース切替時に stats をリセット。
  // selected.id だけだと、別ソース (Mirakurun ↔ EPGStation) の同 channelId
  // へ切り替わったときに発火せず、古いビットレート等が残る。url も依存に
  // 入れることでソース切替時もリセットされる。
  useEffect(() => {
    setStats({});
  }, [selected?.id, selected?.url]);

  const handleStats = useCallback((s: PlaybackStats) => {
    setStats((prev) => ({ ...prev, ...s }));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <TopBar onOpenSettings={() => setSettingsOpen(true)} />

      <div className="flex-1 flex min-h-0">
        <Sidebar />

        <main
          className="flex-1 overflow-y-auto p-4 bg-slate-900"
          // 横向き iOS で右ノッチを避ける。下端は viewport 端まで bg-slate-900
          // を伸ばし、ホームインジケータは slate-900 上に半透明で乗る形にする
          // (padding-bottom を入れると下端に大きな空白が見えるので付けない)。
          style={{
            paddingRight: "max(env(safe-area-inset-right), 1rem)",
          }}
        >
          {selected?.kind === "epgstation-hls" ? (
            <HlsPlayer channel={selected} onStats={handleStats} />
          ) : (
            <TsLivePlayer channel={selected} onStats={handleStats} />
          )}
          <div className="mt-4 grid gap-3 grid-cols-1 lg:grid-cols-2">
            <EpgPanel channel={selected} />
            <StatsPanel channel={selected} stats={stats} />
          </div>
          {!hasSource && (
            <div className="mt-6 p-6 text-center text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg">
              右上の <span className="text-cyan-400">設定</span> から m3u を登録してください。
            </div>
          )}
          {/*
            ホームインジケータ領域分のスクロール余白だけ確保。bg は main の
            slate-900 が viewport 末端まで伸びるため、見た目の "底浮き" は出ない。
          */}
          <div
            aria-hidden
            style={{ height: "env(safe-area-inset-bottom)" }}
          />
        </main>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
