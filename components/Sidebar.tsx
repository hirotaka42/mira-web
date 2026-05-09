"use client";

import { useMemo } from "react";
import { Search, Tv, Satellite, Radio } from "lucide-react";
import { useStore } from "@/lib/store";
import { groupChannels } from "@/lib/m3u";
import type { Channel } from "@/lib/types";

const GROUP_ICON: Record<string, typeof Tv> = {
  GR: Tv,
  BS: Satellite,
  CS: Radio,
};

const GROUP_LABEL: Record<string, string> = {
  GR: "地上波",
  BS: "BS",
  CS: "CS",
};

export default function Sidebar() {
  const channels = useStore((s) => s.channels);
  const search = useStore((s) => s.search);
  const setSearch = useStore((s) => s.setSearch);
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const selectedId = useStore((s) => s.selectedId);
  const selectChannel = useStore((s) => s.selectChannel);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter((c) => c.name.toLowerCase().includes(q));
  }, [channels, search]);

  const grouped = useMemo(() => groupChannels(filtered), [filtered]);

  if (collapsed) {
    return (
      <aside className="w-14 bg-slate-800 border-r border-slate-700 shrink-0 overflow-hidden flex flex-col">
        <div className="flex flex-col items-center py-4 gap-3">
          {Array.from(grouped.keys()).map((g) => {
            const Icon = GROUP_ICON[g] ?? Tv;
            return (
              <div
                key={g}
                className="w-8 h-8 flex items-center justify-center text-slate-400"
                title={GROUP_LABEL[g] ?? g}
              >
                <Icon size={16} />
              </div>
            );
          })}
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-72 bg-slate-800 border-r border-slate-700 shrink-0 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-slate-700">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="チャンネル検索…"
            className="w-full bg-slate-900 border border-slate-700 rounded-md pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {channels.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            m3u を登録するとチャンネルが表示されます。
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            一致するチャンネルがありません。
          </div>
        ) : (
          Array.from(grouped.entries()).map(([group, items]) => (
            <GroupSection
              key={group}
              group={group}
              items={items}
              selectedId={selectedId}
              onSelect={selectChannel}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function GroupSection({
  group,
  items,
  selectedId,
  onSelect,
}: {
  group: string;
  items: Channel[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const Icon = GROUP_ICON[group] ?? Tv;
  return (
    <div>
      <div className="flex items-center px-3.5 py-2.5 bg-slate-900/40 text-[11px] tracking-widest uppercase text-slate-400">
        <Icon size={13} className="mr-2" />
        <span className="flex-1">{GROUP_LABEL[group] ?? group}</span>
        <span className="bg-slate-700 text-slate-400 text-[10px] px-1.5 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>
      <div>
        {items.map((c) => {
          const active = c.id === selectedId;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`w-full flex items-center pl-9 pr-3.5 py-2 text-sm text-left transition-colors border-l-[3px] ${
                active
                  ? "bg-teal-900/40 border-l-emerald-400 text-white"
                  : "border-l-transparent text-slate-300 hover:bg-slate-700/50"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mr-2.5 shrink-0 ${
                  active ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-slate-600"
                }`}
              />
              <span className="truncate">{c.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
