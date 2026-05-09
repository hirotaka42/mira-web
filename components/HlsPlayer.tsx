"use client";

import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import type { Channel, PlaybackStats } from "@/lib/types";
import { buildFetchInit, mixedContentWarning, validateUrl } from "@/lib/safeFetch";

/**
 * EPGStation の HLS ライブストリームを再生するプレイヤー。
 *
 * 流れ:
 *   ① GET /api/streams/live/{ch}/hls?mode=N → JSON {streamId: N}
 *   ② /streamfiles/stream{N}.m3u8 を 200 になるまで polling (最大 ~30 秒)
 *   ③ Safari は <video src=...m3u8> でネイティブ再生、それ以外は hls.js
 *   ④ unmount 時に DELETE /api/streams/{streamId} で停止 → tuner 解放
 *
 * iOS Safari でも動くため WebGPU/WebCodecs/SharedArrayBuffer は不要。
 */

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 45_000;

interface StartStreamInfo {
  streamId: number;
}

function canPlayNativeHls(): boolean {
  if (typeof document === "undefined") return false;
  const v = document.createElement("video");
  return (
    v.canPlayType("application/vnd.apple.mpegurl") !== "" ||
    v.canPlayType("audio/mpegurl") !== ""
  );
}

interface Props {
  channel: Channel | null;
  onStats?: (stats: PlaybackStats) => void;
}

export default function HlsPlayer({ channel, onStats }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onStatsRef = useRef(onStats);
  const finalCleanupRef = useRef<(() => void) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [waitingMessage, setWaitingMessage] = useState<string | null>(null);

  useEffect(() => {
    onStatsRef.current = onStats;
  }, [onStats]);

  useEffect(() => {
    if (!channel) {
      setError(null);
      setLoading(false);
      setWaitingMessage(null);
      return;
    }
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    const ac = new AbortController();
    let hls: Hls | null = null;
    let streamId: number | null = null;
    let baseOrigin: string | null = null;

    setError(null);
    setLoading(true);
    setWaitingMessage("ストリーム起動中…");

    (async () => {
      // ① 起動 RPC
      let parsed;
      try {
        parsed = validateUrl(channel.url);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
        return;
      }
      const warn = mixedContentWarning(parsed.url);
      if (warn) {
        if (!cancelled) {
          setError(warn);
          setLoading(false);
        }
        return;
      }
      baseOrigin = parsed.url.origin;

      let info: StartStreamInfo;
      try {
        const res = await fetch(parsed.url.toString(), buildFetchInit(parsed.url, ac.signal));
        if (!res.ok) throw new Error(`stream start ${res.status} ${res.statusText}`);
        info = await res.json();
      } catch (e) {
        if (cancelled) return;
        if (e instanceof Error && e.name === "AbortError") return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(
          msg.includes("Failed to fetch")
            ? `${msg} — EPGStation 側で CORS / Origin 許可が必要です`
            : msg
        );
        setLoading(false);
        return;
      }
      if (cancelled) return;
      streamId = info.streamId;

      // ② m3u8 file が出るまで polling
      const m3u8Url = `${baseOrigin}/streamfiles/stream${streamId}.m3u8`;
      const m3u8Parsed = new URL(m3u8Url);
      const startedAt = Date.now();
      setWaitingMessage("トランスコード待機中… (約 15-20 秒)");

      while (!cancelled) {
        try {
          const headInit = buildFetchInit(m3u8Parsed, ac.signal, { method: "HEAD" });
          const res = await fetch(m3u8Url, headInit);
          if (res.ok) break;
        } catch (e) {
          if (cancelled) return;
          if (e instanceof Error && e.name === "AbortError") return;
          // poll 中は落とさず継続
        }
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          if (!cancelled) {
            setError("HLS ストリームの起動がタイムアウトしました");
            setLoading(false);
          }
          return;
        }
        await sleep(POLL_INTERVAL_MS);
      }
      if (cancelled) return;

      // ③ 再生開始
      setWaitingMessage(null);
      try {
        if (canPlayNativeHls()) {
          // Safari (macOS / iOS) はネイティブ HLS
          video.src = m3u8Url;
          video.muted = true;
          await video.play().catch(() => {
            /* autoplay 失敗時はユーザーが controls から手動再生 */
          });
        } else {
          // それ以外 (Chrome / Edge / Firefox 等) は hls.js
          const mod = await import("hls.js");
          if (cancelled) return;
          const HlsCtor = mod.default;
          if (!HlsCtor.isSupported()) {
            throw new Error("このブラウザは HLS 再生に対応していません");
          }
          hls = new HlsCtor({
            // ライブの低遅延寄り設定
            lowLatencyMode: true,
            backBufferLength: 30,
            maxBufferLength: 10,
            liveSyncDurationCount: 3,
          });
          hls.attachMedia(video);
          hls.loadSource(m3u8Url);
          hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
            video.muted = true;
            video.play().catch(() => {
              /* autoplay 制限時は手動再生 */
            });
          });
          hls.on(HlsCtor.Events.ERROR, (_event, data) => {
            if (data.fatal) {
              setError(`HLS エラー: ${data.type} / ${data.details}`);
            }
          });
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
        return;
      }

      // ④ 統計情報 (簡易: video element から取れるものだけ)
      const onLoadedMeta = () => {
        if (cancelled) return;
        onStatsRef.current?.({
          resolution: video.videoWidth && video.videoHeight ?
            `${video.videoWidth} × ${video.videoHeight}` : undefined,
          codec: "HLS (H.264 / AAC)",
        });
        setLoading(false);
      };
      video.addEventListener("loadedmetadata", onLoadedMeta);

      // periodic buffer stats
      const statsTimer = setInterval(() => {
        if (cancelled) return;
        try {
          const buf = video.buffered.length > 0
            ? Number(
                (video.buffered.end(video.buffered.length - 1) - video.currentTime).toFixed(2)
              )
            : undefined;
          onStatsRef.current?.({ buffer: buf });
        } catch {}
      }, 2000);

      // cleanup hooks
      const cleanups = () => {
        try { video.removeEventListener("loadedmetadata", onLoadedMeta); } catch {}
        clearInterval(statsTimer);
      };

      // 終了時用に保存
      finalCleanupRef.current = cleanups;
    })();

    return () => {
      cancelled = true;
      try { ac.abort(); } catch {}
      if (finalCleanupRef.current) {
        try { finalCleanupRef.current(); } catch {}
        finalCleanupRef.current = null;
      }
      if (hls) {
        try { hls.destroy(); } catch {}
        hls = null;
      }
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {}
      // ④ サーバ側ストリーム停止
      if (streamId != null && baseOrigin) {
        const stopUrl = `${baseOrigin}/api/streams/${streamId}`;
        fetch(stopUrl, { method: "DELETE", mode: "cors", credentials: "omit" }).catch(
          () => {
            /* best-effort */
          }
        );
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel?.id, channel?.url]);

  if (!channel) {
    return (
      <div className="aspect-video w-full rounded-lg bg-black flex items-center justify-center text-slate-600 border border-slate-800">
        <div className="text-center">
          <div className="text-4xl mb-3 opacity-30">▶</div>
          <div className="text-sm">チャンネルを選択してください</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full rounded-lg bg-black overflow-hidden shadow-2xl shadow-black/50">
      <video
        key={channel.id}
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain"
        controls
        autoPlay
        playsInline
        muted
      />
      {loading && !error && (
        <div className="absolute top-3 right-3 px-3 py-1.5 rounded-md bg-black/70 backdrop-blur text-cyan-400 text-xs border border-cyan-500/30 animate-pulse pointer-events-none max-w-[80%] truncate">
          {waitingMessage ?? "読み込み中…"} {channel.name}
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85 p-6 z-10">
          <div className="max-w-md text-center">
            <div className="text-red-400 text-sm font-mono mb-2 break-all">{error}</div>
            <div className="text-slate-500 text-xs">
              EPGStation 側で CORS / HTTPS / トランスコード設定が必要です
            </div>
          </div>
        </div>
      )}
      <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded bg-black/60 backdrop-blur-sm text-xs text-slate-200 border border-white/5 pointer-events-none">
        <span className="text-emerald-400 mr-2">●</span>
        HLS · {channel.name}
      </div>
    </div>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
