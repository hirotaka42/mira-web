"use client";

import { useEffect, useRef, useState } from "react";
import { X, Upload, Link2, Type, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = "url" | "text" | "file";

export default function SettingsModal({ open, onClose }: Props) {
  const setSource = useStore((s) => s.setSource);
  const clear = useStore((s) => s.clear);
  const currentSource = useStore((s) => s.source);
  const channelCount = useStore((s) => s.channels.length);
  const storeError = useStore((s) => s.error);
  const loading = useStore((s) => s.loading);

  const [tab, setTab] = useState<Tab>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // build-time に CI から注入された既定 URL (空文字なら未設定)
  const defaultUrl = process.env.NEXT_PUBLIC_DEFAULT_PLAYLIST_URL ?? "";

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (currentSource?.kind === "url") {
      setTab("url");
      setUrl(currentSource.value);
    } else if (currentSource?.kind === "text") {
      setTab("text");
      setText(currentSource.value);
    } else if (defaultUrl) {
      // 永続化された source も無し、build-time 既定 URL があればプリフィル
      setTab("url");
      setUrl(defaultUrl);
    }
  }, [open, currentSource, defaultUrl]);

  useEffect(() => {
    setError(storeError);
  }, [storeError]);

  if (!open) return null;

  async function applyUrl() {
    setError(null);
    if (!url.trim()) {
      setError("URL を入力してください");
      return;
    }
    try {
      await setSource({ kind: "url", value: url.trim() });
      onClose();
    } catch {
      /* setError handled via storeError */
    }
  }

  async function applyText() {
    setError(null);
    if (!text.trim()) {
      setError("m3u テキストを貼り付けてください");
      return;
    }
    try {
      await setSource({ kind: "text", value: text });
      onClose();
    } catch {
      /* */
    }
  }

  async function handleFile(file: File) {
    setError(null);
    try {
      const buf = await file.text();
      setText(buf);
      await setSource({ kind: "text", value: buf });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-5 py-3.5 border-b border-slate-700">
          <h2 className="text-base font-semibold text-slate-100">m3u 設定</h2>
          {channelCount > 0 && (
            <span className="ml-3 text-xs text-slate-500">
              現在 {channelCount} ch 登録済み
            </span>
          )}
          <button
            onClick={onClose}
            className="ml-auto w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-800 transition-colors"
            aria-label="閉じる"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="flex gap-1 border-b border-slate-700">
            <TabButton active={tab === "url"} onClick={() => setTab("url")}>
              <Link2 size={13} /> URL
            </TabButton>
            <TabButton active={tab === "text"} onClick={() => setTab("text")}>
              <Type size={13} /> テキスト
            </TabButton>
            <TabButton active={tab === "file"} onClick={() => setTab("file")}>
              <Upload size={13} /> ファイル
            </TabButton>
          </div>
        </div>

        <div className="px-5 py-5 min-h-[260px]">
          {tab === "url" && (
            <div>
              <label className="block text-xs text-slate-400 mb-2">
                Mirakurun の m3u エンドポイント
              </label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://mirakurun.example:40772/api/iptv/playlist"
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-cyan-500 font-mono"
              />
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                サーバ側でプロキシ取得します (CORS 不要)。Next.js サーバから対象ホストへ到達できる必要があります。
              </p>
            </div>
          )}

          {tab === "text" && (
            <div>
              <label className="block text-xs text-slate-400 mb-2">
                m3u テキスト貼付
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="#EXTM3U&#10;#EXTINF:-1 tvg-id=&quot;...&quot; group-title=&quot;GR&quot;,チャンネル名&#10;http://..."
                className="w-full h-44 bg-slate-950 border border-slate-700 rounded-md px-3 py-2.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-cyan-500 font-mono resize-none"
              />
            </div>
          )}

          {tab === "file" && (
            <div>
              <label className="block text-xs text-slate-400 mb-2">
                ローカルの .m3u ファイルを選択
              </label>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-lg py-12 flex flex-col items-center gap-2 text-slate-400 hover:text-cyan-300 transition-colors"
              >
                <Upload size={28} />
                <span className="text-sm">クリックしてファイルを選択</span>
                <span className="text-xs text-slate-600">.m3u / .m3u8</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".m3u,.m3u8,audio/x-mpegurl,application/x-mpegurl,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 rounded-md bg-red-950/40 border border-red-900/60 text-red-300 text-xs font-mono">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-700 bg-slate-900/60">
          <button
            onClick={() => {
              clear();
              setUrl("");
              setText("");
              setError(null);
            }}
            disabled={!currentSource}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Trash2 size={12} /> 設定を削除
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-md transition-colors"
            >
              キャンセル
            </button>
            {tab === "url" && (
              <button
                onClick={applyUrl}
                disabled={loading}
                className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-md transition-colors disabled:opacity-50"
              >
                {loading ? "取得中…" : "URL から読み込む"}
              </button>
            )}
            {tab === "text" && (
              <button
                onClick={applyText}
                disabled={loading}
                className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-md transition-colors disabled:opacity-50"
              >
                {loading ? "処理中…" : "テキストを適用"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 transition-colors ${
        active
          ? "border-cyan-500 text-cyan-400"
          : "border-transparent text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
