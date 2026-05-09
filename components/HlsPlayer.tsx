"use client";

import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import { PictureInPicture2 } from "lucide-react";
import type { Channel, PlaybackStats } from "@/lib/types";
import { buildFetchInit, mixedContentWarning, validateUrl } from "@/lib/safeFetch";

/** Picture-in-Picture をサポートするか (W3C / WebKit のいずれか) */
function isPipSupported(): boolean {
  if (typeof document === "undefined") return false;
  // W3C
  if ("pictureInPictureEnabled" in document && (document as Document).pictureInPictureEnabled) {
    return true;
  }
  // WebKit (Safari iOS / macOS)
  const v = document.createElement("video") as HTMLVideoElement & {
    webkitSupportsPresentationMode?: (mode: string) => boolean;
  };
  if (typeof v.webkitSupportsPresentationMode === "function") {
    try {
      return v.webkitSupportsPresentationMode("picture-in-picture");
    } catch {
      return false;
    }
  }
  return false;
}

interface VideoWithWebkitPiP extends HTMLVideoElement {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitPresentationMode?: string;
}

async function togglePictureInPicture(video: HTMLVideoElement | null): Promise<void> {
  if (!video) return;
  const v = video as VideoWithWebkitPiP;
  // W3C 優先
  if (
    typeof document !== "undefined" &&
    "pictureInPictureEnabled" in document &&
    document.pictureInPictureEnabled
  ) {
    if (document.pictureInPictureElement === video) {
      await document.exitPictureInPicture();
    } else {
      await video.requestPictureInPicture();
    }
    return;
  }
  // WebKit fallback
  if (typeof v.webkitSetPresentationMode === "function") {
    if (v.webkitPresentationMode === "picture-in-picture") {
      v.webkitSetPresentationMode("inline");
    } else {
      v.webkitSetPresentationMode("picture-in-picture");
    }
  }
}

/**
 * EPGStation の HLS ライブストリームを再生するプレイヤー。
 *
 * EPGStation 公式 WebUI (LiveHLSVideo.vue / LiveHLSVideoState.ts) と同じ
 * プロトコルに揃えてある:
 *
 *   1. POST/GET /api/streams/live/{ch}/hls?mode=N → JSON {streamId}
 *   2. /api/streams?isHalfWidth=true を 1秒間隔で polling し、
 *      自分の streamId の isEnable === true を待つ
 *   3. <video> に m3u8 URL を渡す (Safari ネイティブ HLS / hls.js は new Hls() のみ)
 *   4. ストリーム維持: 10秒ごとに PUT /api/streams/{streamId}/keep
 *      (これを送らないとサーバ側で自動停止される)
 *   5. unmount 時: keepalive 停止 → DELETE /api/streams/{streamId}
 *
 * iOS Safari でも動くため WebGPU/WebCodecs/SharedArrayBuffer は不要。
 */

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 60_000;
const KEEP_INTERVAL_MS = 10_000;

interface StartStreamInfo {
  streamId: number;
}

interface StreamInfoItem {
  streamId: number;
  isEnable: boolean;
  type: string;
  channelId?: number;
}

interface StreamInfo {
  items: StreamInfoItem[];
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
  const [pipSupported, setPipSupported] = useState(false);

  useEffect(() => {
    onStatsRef.current = onStats;
  }, [onStats]);

  useEffect(() => {
    setPipSupported(isPipSupported());
  }, []);

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
    let keepTimer: ReturnType<typeof setInterval> | null = null;

    setError(null);
    setLoading(true);
    setWaitingMessage("ストリーム起動中…");

    (async () => {
      // 入力 URL 検証
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

      // ① ストリーム起動 RPC
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

      // ② keepalive を即時開始 (これが無いとサーバ側でストリームが自動停止される)
      const startKeep = (sid: number) => {
        if (keepTimer) clearInterval(keepTimer);
        keepTimer = setInterval(() => {
          if (cancelled) return;
          fetch(`${baseOrigin}/api/streams/${sid}/keep`, {
            method: "PUT",
            mode: "cors",
            credentials: "omit",
          }).catch(() => {
            /* best-effort, transient errors are tolerated */
          });
        }, KEEP_INTERVAL_MS);
      };
      startKeep(streamId);

      // ③ /api/streams で自分の streamId が isEnable=true になるまで polling
      //    (m3u8 ファイル HEAD ではなく、サーバ側の "ready" 状態を見る)
      setWaitingMessage("トランスコード待機中…");
      const startedAt = Date.now();
      const isHalfWidthSuffix = "?isHalfWidth=true";
      const streamsUrl = `${baseOrigin}/api/streams${isHalfWidthSuffix}`;
      let ready = false;
      while (!cancelled && Date.now() - startedAt < POLL_TIMEOUT_MS) {
        try {
          const res = await fetch(streamsUrl, {
            method: "GET",
            mode: "cors",
            credentials: "omit",
            cache: "no-store",
            signal: ac.signal,
          });
          if (res.ok) {
            const data: StreamInfo = await res.json();
            const me = data.items.find((it) => it.streamId === streamId);
            if (me && me.isEnable === true) {
              ready = true;
              break;
            }
          }
        } catch (e) {
          if (cancelled) return;
          if (e instanceof Error && e.name === "AbortError") return;
          // transient errors during warmup; keep polling
        }
        await sleep(POLL_INTERVAL_MS);
      }
      if (cancelled) return;
      if (!ready) {
        setError("HLS ストリームの起動がタイムアウトしました (60秒以上 isEnable に到達せず)");
        setLoading(false);
        return;
      }

      // ④ 再生開始
      setWaitingMessage(null);
      const m3u8Url = `${baseOrigin}/streamfiles/stream${streamId}.m3u8`;
      try {
        if (canPlayNativeHls()) {
          // Safari (macOS / iOS) はネイティブ HLS
          video.src = m3u8Url;
          // muted は強制せず、ブラウザの autoplay policy に任せる:
          //   desktop は通常そのまま再生、iOS は controls の play ボタンで手動開始
          video.play().catch(() => {
            /* autoplay 制限時 (主に iOS) はユーザーが controls から手動再生 */
          });
        } else {
          // それ以外 (Chrome / Edge / Firefox 等) は hls.js
          // EPGStation 公式 WebUI と同じく `new Hls()` のみ。オプションは
          // 入れないこと (lowLatencyMode 等は EPGStation の通常 HLS と相性悪い)。
          const mod = await import("hls.js");
          if (cancelled) return;
          const HlsCtor = mod.default;
          if (!HlsCtor.isSupported()) {
            throw new Error("このブラウザは HLS 再生に対応していません");
          }
          hls = new HlsCtor();
          hls.loadSource(m3u8Url);
          hls.attachMedia(video);
          hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {
              /* autoplay 制限時はユーザーが controls から手動再生 */
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

      // ⑤ 統計情報
      const onLoadedMeta = () => {
        if (cancelled) return;
        onStatsRef.current?.({
          resolution:
            video.videoWidth && video.videoHeight
              ? `${video.videoWidth} × ${video.videoHeight}`
              : undefined,
          codec: "HLS (H.264 / AAC)",
        });
        setLoading(false);
      };
      video.addEventListener("loadedmetadata", onLoadedMeta);

      const statsTimer = setInterval(() => {
        if (cancelled) return;
        try {
          const buf =
            video.buffered.length > 0
              ? Number(
                  (
                    video.buffered.end(video.buffered.length - 1) - video.currentTime
                  ).toFixed(2)
                )
              : undefined;
          onStatsRef.current?.({ buffer: buf });
        } catch {}
      }, 2000);

      finalCleanupRef.current = () => {
        try { video.removeEventListener("loadedmetadata", onLoadedMeta); } catch {}
        clearInterval(statsTimer);
      };
    })();

    return () => {
      cancelled = true;
      try { ac.abort(); } catch {}
      if (keepTimer) {
        clearInterval(keepTimer);
        keepTimer = null;
      }
      if (finalCleanupRef.current) {
        try { finalCleanupRef.current(); } catch {}
        finalCleanupRef.current = null;
      }
      if (hls) {
        try { hls.stopLoad(); } catch {}
        try { hls.detachMedia(); } catch {}
        try { hls.destroy(); } catch {}
        hls = null;
      }
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {}
      // サーバ側ストリーム停止 (チューナー解放)
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
      {/*
        PiP ボタン: PWA standalone (iOS) では native video controls の PiP
        ボタンが消えるため、独自に提供する。W3C requestPictureInPicture が
        無ければ WebKit webkitSetPresentationMode を使う。
      */}
      {pipSupported && !error && (
        <button
          type="button"
          onClick={() => {
            togglePictureInPicture(videoRef.current).catch(() => {
              /* user gesture でない場合等は無視 */
            });
          }}
          className="absolute top-3 left-3 w-9 h-9 rounded-md flex items-center justify-center bg-black/60 backdrop-blur-sm border border-white/10 text-slate-200 hover:bg-black/80 hover:text-cyan-300 transition-colors"
          aria-label="ピクチャ・イン・ピクチャ切替"
          title="PiP"
        >
          <PictureInPicture2 size={16} />
        </button>
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
