"use client";

import { Menu, Settings, RotateCw } from "lucide-react";
import { useStore, useSelectedChannel } from "@/lib/store";

interface Props {
  onOpenSettings: () => void;
}

export default function TopBar({ onOpenSettings }: Props) {
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const reload = useStore((s) => s.reload);
  const loading = useStore((s) => s.loading);
  const hasSource = useStore((s) => !!s.source);
  const selected = useSelectedChannel();

  return (
    <header className="h-14 flex items-center px-4 gap-3 bg-slate-800 border-b border-slate-700 shrink-0">
      <button
        onClick={toggleSidebar}
        className="w-9 h-9 rounded-md flex items-center justify-center text-slate-300 hover:bg-slate-700 transition-colors"
        aria-label="サイドバー切替"
      >
        <Menu size={18} />
      </button>

      <div className="text-sm font-semibold text-cyan-400 tracking-wide flex items-center gap-2">
        <span aria-hidden>▣</span>
        Mirakurun WebUI
      </div>

      <div className="flex-1 flex items-center text-sm text-slate-200 min-w-0">
        {selected ? (
          <>
            <span className="inline-block bg-red-500 text-white text-[10px] font-semibold tracking-widest px-1.5 py-0.5 rounded mr-2 shrink-0">
              LIVE
            </span>
            <span className="truncate">{selected.name}</span>
            <span className="text-slate-500 ml-2 text-xs shrink-0">
              {selected.group} · {selected.id}
            </span>
          </>
        ) : (
          <span className="text-slate-500">
            {hasSource ? "チャンネル未選択" : "m3u 未設定 — 右上の設定から登録"}
          </span>
        )}
      </div>

      <button
        onClick={() => reload()}
        disabled={!hasSource || loading}
        className="w-9 h-9 rounded-md flex items-center justify-center text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="再読み込み"
        title="m3u 再読み込み"
      >
        <RotateCw size={16} className={loading ? "animate-spin" : ""} />
      </button>

      <button
        onClick={onOpenSettings}
        className="w-9 h-9 rounded-md flex items-center justify-center text-slate-300 hover:bg-slate-700 transition-colors"
        aria-label="設定"
      >
        <Settings size={18} />
      </button>
    </header>
  );
}
