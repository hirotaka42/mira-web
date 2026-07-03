"use client";

import { describePlayerError } from "@/lib/playerError";

interface Props {
  error: string;
  hint: string;
  onRetry: () => void;
}

export default function PlayerErrorOverlay({ error, hint, onRetry }: Props) {
  const friendly = describePlayerError(error);

  return (
    <div
      role="alert"
      className="absolute inset-0 flex items-center justify-center bg-black/85 p-6 z-10"
    >
      <div className="max-w-md text-center">
        <div className="text-red-300 text-sm mb-3">{friendly}</div>
        <details className="text-left mb-4">
          <summary className="text-slate-500 text-xs cursor-pointer select-none hover:text-slate-400 transition-colors">
            技術詳細
          </summary>
          <div className="mt-2 p-3 rounded-md bg-slate-900/60 border border-slate-700">
            <div className="text-red-400 text-xs font-mono break-all">{error}</div>
            {hint && (
              <div className="text-slate-500 text-xs mt-2">{hint}</div>
            )}
          </div>
        </details>
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-md transition-colors"
        >
          再試行
        </button>
      </div>
    </div>
  );
}
