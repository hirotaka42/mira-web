"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronDown, ChevronRight } from "lucide-react";
import type { Channel } from "@/lib/types";
import {
  fetchCurrentProgram,
  formatDuration,
  formatHm,
  progressRatio,
  remainingMs,
  type CurrentProgram,
} from "@/lib/epg";

interface Props {
  channel: Channel | null;
}

const REFRESH_INTERVAL_MS = 30_000;
const TICK_INTERVAL_MS = 1_000;

export default function EpgPanel({ channel }: Props) {
  const [program, setProgram] = useState<CurrentProgram | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [showExtended, setShowExtended] = useState(false);

  // チャンネル変更時に番組情報を取得 + 30秒ごとに再取得
  useEffect(() => {
    if (!channel) {
      setProgram(null);
      setErr(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const ac = new AbortController();
    setShowExtended(false);

    const fetchNow = async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const p = await fetchCurrentProgram(channel, ac.signal);
        if (cancelled) return;
        setProgram(p);
        setErr(p ? null : "番組情報を取得できませんでした");
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchNow();
    const t = setInterval(fetchNow, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
      try { ac.abort(); } catch {}
    };
  }, [channel?.id, channel?.url]);

  // 進捗バー / 残り時間用に 1 秒刻みで now を更新
  useEffect(() => {
    if (!program) return;
    const t = setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS);
    return () => clearInterval(t);
  }, [program]);

  // 番組終了が近づいたら即時取得 (次番組への自動切替のため)
  useEffect(() => {
    if (!program) return;
    const remaining = remainingMs(program, now);
    if (remaining < 5_000 && remaining >= 0) {
      // 5秒以内に終了する場合、3秒後に再取得
      const t = setTimeout(() => setNow(Date.now()), 3_000);
      return () => clearTimeout(t);
    }
  }, [program, now]);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <h3 className="flex items-center gap-2 text-[11px] tracking-widest uppercase text-slate-400 mb-3">
        <CalendarDays size={13} /> 番組情報
        {loading && (
          <span className="ml-auto text-cyan-400/70 text-[10px] normal-case tracking-normal">
            更新中…
          </span>
        )}
      </h3>

      {!channel ? (
        <div className="text-sm text-slate-500">チャンネル未選択</div>
      ) : program ? (
        <div>
          <div className="text-sm font-semibold text-slate-100 leading-tight">
            {program.name}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span>
              {formatHm(program.startAt)} – {formatHm(program.endAt)}
            </span>
            <span className="text-slate-600">·</span>
            <span>
              残り {formatDuration(remainingMs(program, now))}
            </span>
          </div>

          {/* 進捗バー */}
          <div className="mt-2 h-1 bg-slate-700/60 rounded overflow-hidden">
            <div
              className="h-full bg-cyan-500/70 transition-[width] duration-1000 ease-linear"
              style={{ width: `${(progressRatio(program, now) * 100).toFixed(2)}%` }}
            />
          </div>

          {program.description && (
            <p className="mt-3 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
              {program.description}
            </p>
          )}

          {program.extended && (
            <div className="mt-2">
              <button
                onClick={() => setShowExtended((v) => !v)}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-300 transition-colors"
              >
                {showExtended ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                詳細
              </button>
              {showExtended && (
                <p className="mt-1 text-[11px] text-slate-400 leading-relaxed whitespace-pre-wrap">
                  {program.extended}
                </p>
              )}
            </div>
          )}
        </div>
      ) : err ? (
        <div className="text-xs text-slate-500">
          {err}
          <span className="block text-[11px] text-slate-600 mt-1">
            番組情報は EPGStation の <code className="text-slate-500">/api/schedules/broadcasting</code> から取得しています。
            Mirakurun 直モード時はプリセット (Variable) に EPGStation の URL が登録されていれば自動でそちらを参照します。
          </span>
        </div>
      ) : (
        <div className="text-sm text-slate-500">読み込み中…</div>
      )}
    </div>
  );
}
