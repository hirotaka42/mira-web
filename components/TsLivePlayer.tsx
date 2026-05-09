"use client";

import { useEffect, useRef, useState } from "react";
import type { Channel, PlaybackStats } from "@/lib/types";
import type { TsLiveModule, TsLiveStats } from "@/types/ts-live";
import { buildFetchInit, mixedContentWarning, validateUrl } from "@/lib/safeFetch";

/**
 * Mirakurun の生 MPEG-TS をブラウザ内で復号するプレイヤー。
 *
 * 構成:
 *  - ts-live.js (Emscripten + ffmpeg + pthread + WebGPU + WebCodecs) で MPEG-2 復号
 *  - canvas (id="video") に WebGPU 経由でフレームを描画
 *  - 音声は WASM 内の AudioWorklet で再生
 *
 * 要件:
 *  - SharedArrayBuffer (COOP=same-origin / COEP=require-corp)
 *  - WebGPU (Chrome 113+, Edge 113+, Safari 18+)
 *  - WebCodecs API
 */

// ts-live.js のスクリプトをページに 1 回だけ挿入
// basePath を含めるため process.env.NEXT_PUBLIC_BASE_PATH を考慮する
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

let scriptPromise: Promise<void> | null = null;
function loadTsLiveScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.createWasmModule) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `${BASE_PATH}/wasm/ts-live.js`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("ts-live.js のロードに失敗しました"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface NavigatorWithGPU extends Navigator {
  gpu?: {
    requestAdapter(): Promise<{ requestDevice(): Promise<unknown> } | null>;
  };
}

/**
 * iOS / iPadOS 上の WebKit 系ブラウザを検出する。
 * iOS では Safari/Chrome/Edge いずれも内部は WebKit のため、
 * WebGPU は Feature Flag が必要 + WebCodecs は MPEG-2 を復号できないため
 * このアプリは現状動作しない。
 */
function detectAppleMobileWebKit(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPhone / iPod
  if (/iPhone|iPod/i.test(ua)) return true;
  // iPad (iPadOS 13+ は Mac UA を返す → "iPad" or maxTouchPoints で検出)
  if (/iPad/i.test(ua)) return true;
  if (
    /Macintosh/i.test(ua) &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  ) {
    return true;
  }
  return false;
}

async function initWasmModule(): Promise<TsLiveModule> {
  const nav = navigator as NavigatorWithGPU;

  if (!nav.gpu) {
    if (detectAppleMobileWebKit()) {
      throw new Error(
        "iOS / iPadOS 上では現状ご利用いただけません。WebGPU が Feature Flag " +
          "なため、有効化しても WebCodecs が MPEG-2 video の復号に対応せず再生不可です。" +
          "Mac の Chrome / Edge / Safari からアクセスしてください。"
      );
    }
    throw new Error(
      "このブラウザは WebGPU に対応していません (Chrome / Edge 113+ もしくは macOS Safari 18+ をお試しください)"
    );
  }
  if (typeof SharedArrayBuffer === "undefined") {
    throw new Error(
      "SharedArrayBuffer が利用できません (Cross-Origin Isolation 未成立)。ハードリロードを試してください"
    );
  }
  if (typeof (globalThis as Record<string, unknown>).VideoDecoder === "undefined") {
    throw new Error("このブラウザは WebCodecs に対応していません");
  }
  await loadTsLiveScript();
  const adapter = await nav.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("WebGPU アダプターが取得できません (GPU ドライバ非対応の可能性)");
  }
  const device = await adapter.requestDevice();
  if (!window.createWasmModule) {
    throw new Error("ts-live.js の初期化に失敗しました");
  }
  const mod = await window.createWasmModule({ preinitializedWebGPUDevice: device });
  return mod;
}

// 1 ページに 1 つだけ wasm モジュールを保持して使い回す (チャンネル切替時は reset)
let modulePromise: Promise<TsLiveModule> | null = null;
function getOrInitModule(): Promise<TsLiveModule> {
  if (!modulePromise) {
    modulePromise = initWasmModule().catch((e) => {
      modulePromise = null;
      throw e;
    });
  }
  return modulePromise;
}

interface Props {
  channel: Channel | null;
  onStats?: (stats: PlaybackStats) => void;
  volume?: number; // 0.0 - 1.0
  muted?: boolean;
}

export default function TsLivePlayer({
  channel,
  onStats,
  volume = 1.0,
  muted = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const moduleRef = useRef<TsLiveModule | null>(null);
  const onStatsRef = useRef(onStats);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    onStatsRef.current = onStats;
  }, [onStats]);

  // 音量 / ミュート同期
  useEffect(() => {
    const m = moduleRef.current;
    if (!m) return;
    try {
      m.setAudioGain(muted ? 0 : volume);
    } catch {}
  }, [volume, muted]);

  useEffect(() => {
    if (!channel) {
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const ac = new AbortController();

    setError(null);
    setLoading(true);

    (async () => {
      let mod: TsLiveModule;
      try {
        mod = await getOrInitModule();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
        return;
      }
      if (cancelled) return;
      moduleRef.current = mod;

      try {
        mod.reset();
      } catch {}
      try {
        mod.setAudioGain(muted ? 0 : volume);
      } catch {}

      try {
        mod.setStatsCallback((statsList) => {
          if (cancelled) return;
          if (statsList && statsList.length > 0) {
            mapStats(statsList[statsList.length - 1], onStatsRef.current);
          }
        });
      } catch {}

      // 静的サイトなので Mirakurun を直接叩く。Mirakurun の CORS allowOrigins と
      // PNA preflight を通すため targetAddressSpace を設定する。
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

      try {
        const res = await fetch(
          parsed.url.toString(),
          buildFetchInit(parsed.url, ac.signal)
        );
        if (!res.ok || !res.body) {
          throw new Error(`stream fetch ${res.status}: ${res.statusText}`);
        }
        const reader = res.body.getReader();
        // 最初のチャンクが届いた時点で loading 解除
        let firstChunkReceived = false;
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value || value.length === 0) continue;
          try {
            const buf = mod.getNextInputBuffer(value.length);
            buf.set(value);
            mod.commitInputData(value.length);
          } catch (ex) {
            if (typeof ex === "number") {
              const msg = mod.getExceptionMsg(ex);
              throw new Error(msg);
            }
            throw ex;
          }
          if (!firstChunkReceived) {
            firstChunkReceived = true;
            if (!cancelled) setLoading(false);
          }
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      try {
        ac.abort();
      } catch {}
      const m = moduleRef.current;
      if (m) {
        try {
          m.setStatsCallback(null);
        } catch {}
        try {
          m.reset();
        } catch {}
      }
    };
  }, [channel?.id, channel?.url]);
  /* eslint-disable-line react-hooks/exhaustive-deps */

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
      <canvas
        ref={canvasRef}
        id="video"
        width={1920}
        height={1080}
        className="absolute inset-0 w-full h-full object-contain"
      />
      {loading && !error && (
        <div className="absolute top-3 right-3 px-3 py-1.5 rounded-md bg-black/70 backdrop-blur text-cyan-400 text-xs border border-cyan-500/30 animate-pulse pointer-events-none">
          読み込み中… {channel.name}
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85 p-6 z-10">
          <div className="max-w-md text-center">
            <div className="text-red-400 text-sm font-mono mb-2 break-all">{error}</div>
            <div className="text-slate-500 text-xs">
              要件: WebGPU + WebCodecs + SharedArrayBuffer 対応ブラウザ
              (Chrome / Edge 113+ または Safari 18+)
            </div>
          </div>
        </div>
      )}
      <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded bg-black/60 backdrop-blur-sm text-xs text-slate-200 border border-white/5 pointer-events-none">
        <span className="text-emerald-400 mr-2">●</span>
        {channel.name}
      </div>
    </div>
  );
}

function mapStats(s: TsLiveStats, cb?: (p: PlaybackStats) => void) {
  if (!cb) return;
  const out: PlaybackStats = {};
  // ts-live が返す statistics の項目は build によって異なるので best-effort
  const get = (k: string) => (typeof s[k] === "number" ? (s[k] as number) : undefined);
  const w = get("VideoFrameQueueSize");
  if (w != null) out.buffer = w / 30; // 概算 (30fps 仮定)
  const decoded = get("DecodedVideoFrames") ?? get("decodedFrames");
  if (decoded != null) out.dropped = (get("DroppedVideoFrames") ?? 0) as number;
  const w2 = get("Width") ?? get("VideoWidth");
  const h2 = get("Height") ?? get("VideoHeight");
  if (w2 && h2) out.resolution = `${w2} × ${h2}`;
  const codec = typeof s["videoCodec"] === "string" ? (s["videoCodec"] as string) : undefined;
  if (codec) out.codec = codec;
  cb(out);
}
