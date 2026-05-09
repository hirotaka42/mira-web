"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";
import Player from "@/components/TsLivePlayer";
import EpgPanel from "@/components/EpgPanel";
import StatsPanel from "@/components/StatsPanel";
import SettingsModal from "@/components/SettingsModal";
import { useStore, useSelectedChannel } from "@/lib/store";
import type { PlaybackStats } from "@/lib/types";

export default function Page() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stats, setStats] = useState<PlaybackStats>({});
  const hasSource = useStore((s) => !!s.source);
  const channels = useStore((s) => s.channels);
  const reload = useStore((s) => s.reload);
  const selected = useSelectedChannel();

  // 初回ロード:
  //   - 永続化済 source があれば再取得
  //   - なければ設定モーダルを開く (URL タブには NEXT_PUBLIC_DEFAULT_PLAYLIST_URL
  //     がプリフィルされる。読み込みは必ずユーザーがボタンを押して実行)
  useEffect(() => {
    if (hasSource && channels.length === 0) {
      reload().catch(() => {});
      return;
    }
    if (!hasSource) {
      setSettingsOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // チャンネル切替時に stats をリセット
  useEffect(() => {
    setStats({});
  }, [selected?.id]);

  const handleStats = useCallback((s: PlaybackStats) => {
    setStats((prev) => ({ ...prev, ...s }));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <TopBar onOpenSettings={() => setSettingsOpen(true)} />

      <div className="flex-1 flex min-h-0">
        <Sidebar />

        <main className="flex-1 overflow-y-auto p-4 bg-slate-900">
          <Player channel={selected} onStats={handleStats} />
          <div className="mt-4 grid gap-3 grid-cols-1 lg:grid-cols-2">
            <EpgPanel channel={selected} />
            <StatsPanel channel={selected} stats={stats} />
          </div>
          {!hasSource && (
            <div className="mt-6 p-6 text-center text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg">
              右上の <span className="text-cyan-400">設定</span> から m3u を登録してください。
            </div>
          )}
        </main>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
