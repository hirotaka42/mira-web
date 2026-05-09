"use client";

import { CalendarDays } from "lucide-react";
import type { Channel } from "@/lib/types";

interface Props {
  channel: Channel | null;
}

export default function EpgPanel({ channel }: Props) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <h3 className="flex items-center gap-2 text-[11px] tracking-widest uppercase text-slate-400 mb-3">
        <CalendarDays size={13} /> 番組情報
      </h3>
      {channel ? (
        <div className="text-sm text-slate-500 italic">
          EPG (xmltv) は今後対応予定。現在は <code className="text-slate-400">{channel.tvgId ?? "—"}</code> で識別。
        </div>
      ) : (
        <div className="text-sm text-slate-500">チャンネル未選択</div>
      )}
    </div>
  );
}
