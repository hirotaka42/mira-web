"use client";

import { BarChart3 } from "lucide-react";
import type { Channel, PlaybackStats } from "@/lib/types";

interface Props {
  channel: Channel | null;
  stats: PlaybackStats;
}

export default function StatsPanel({ channel, stats }: Props) {
  const rows: { key: string; val: string }[] = [
    { key: "解像度", val: stats.resolution ?? "—" },
    {
      key: "ビットレート",
      val: stats.bitrate ? `${(stats.bitrate / 1000).toFixed(2)} Mbps` : "—",
    },
    { key: "コーデック", val: stats.codec ?? "—" },
    { key: "バッファ", val: stats.buffer != null ? `${stats.buffer.toFixed(2)} s` : "—" },
    { key: "ドロップ", val: stats.dropped != null ? String(stats.dropped) : "—" },
    {
      key: "URL",
      val: channel ? truncateUrl(channel.url) : "—",
    },
  ];

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <h3 className="flex items-center gap-2 text-[11px] tracking-widest uppercase text-slate-400 mb-3">
        <BarChart3 size={13} /> ストリーム情報
      </h3>
      <div className="space-y-1">
        {rows.map((r) => (
          <div
            key={r.key}
            className="flex justify-between items-center text-sm py-1.5 border-b border-slate-700 last:border-b-0"
          >
            <span className="text-slate-400">{r.key}</span>
            <span
              className={`font-mono text-slate-200 ${
                r.key === "URL" ? "text-[11px] truncate max-w-[60%] text-right" : ""
              }`}
              title={r.key === "URL" && channel ? channel.url : undefined}
            >
              {r.val}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function truncateUrl(u: string): string {
  try {
    const url = new URL(u);
    return `${url.host}…${url.pathname.slice(-26)}`;
  } catch {
    return u;
  }
}
