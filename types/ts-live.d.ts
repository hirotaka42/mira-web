/**
 * ts-live.js (Emscripten + WebGPU + WebCodecs)
 * — MPEG-TS をブラウザ内で復号する WASM ライブラリ
 * https://github.com/kounoike/ts-live
 *
 * <script src="/wasm/ts-live.js"></script> によって window.createWasmModule が生える。
 */

// WebGPU の型は環境により @webgpu/types が必要なので unknown にする
export interface TsLiveModuleOptions {
  preinitializedWebGPUDevice?: unknown;
  /** TSPlay は明示的には渡していないが、Emscripten の慣例で受ける */
  canvas?: HTMLCanvasElement;
  /** その他 Emscripten Module オーバライド */
  [key: string]: unknown;
}

export interface TsLiveStats {
  videoFrameCount?: number;
  audioFrameCount?: number;
  videoQueueSize?: number;
  audioQueueSize?: number;
  decoder?: string;
  /** ts-live が出すその他統計 */
  [k: string]: unknown;
}

export interface TsLiveCaptionData {
  data: Uint8Array;
  ptsTime: number;
}

export interface TsLiveModule {
  /** WASM 初期化完了 */
  ready: Promise<TsLiveModule>;

  /** TS バイト書き込み用バッファを取得 (Uint8Array, length=要求バイト数) */
  getNextInputBuffer(length: number): Uint8Array;

  /** 上で書き込んだ length バイトをデコーダに投入 */
  commitInputData(length: number): void;

  /** 内部状態をリセット (チャンネル切替時) */
  reset(): void;

  /** 例外番号 → メッセージ */
  getExceptionMsg(ex: number): string;

  /** 統計情報のコールバック登録 (null で解除) */
  setStatsCallback(cb: ((stats: TsLiveStats[]) => void) | null): void;

  /** ARIB字幕コールバック登録 (今回は使わなくても OK) */
  setCaptionCallback(cb: ((caption: TsLiveCaptionData) => void) | null): void;

  /** 音量 0.0 - 1.0 */
  setAudioGain(gain: number): void;

  /** デュアルモノラル 0=mix / 1=L / 2=R */
  setDualMonoMode(mode: number): void;

  /** Emscripten 内部 — 直接触らない */
  canvas?: HTMLCanvasElement;
  arguments?: string[];
  noInitialRun?: boolean;
}

declare global {
  interface Window {
    createWasmModule?: (opts?: TsLiveModuleOptions) => Promise<TsLiveModule>;
  }
}

export {};
