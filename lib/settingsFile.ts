import type { M3uSource } from "./types";
import type { ExternalPlayerKind } from "./externalPlayer";

export interface SettingsFile {
  format: "mira-web-settings";
  version: 1;
  exportedAt: string;
  source: { kind: "url" | "text"; value: string; baseUrl?: string | null };
  settings: {
    showSubChannels?: boolean;
    externalPlayer?: ExternalPlayerKind;
    externalM2tsMode?: number;
  };
}

/** 現在の状態から設定 JSON 文字列(整形済み)を作る */
export function exportSettings(input: {
  source: M3uSource | null;
  showSubChannels: boolean;
  externalPlayer: ExternalPlayerKind;
  externalM2tsMode: number;
  now: string;
}): string {
  const file: SettingsFile = {
    format: "mira-web-settings",
    version: 1,
    exportedAt: input.now,
    source: {
      kind: input.source?.kind ?? "url",
      value: input.source?.value ?? "",
      ...(input.source?.baseUrl ? { baseUrl: input.source.baseUrl } : {}),
    },
    settings: {
      showSubChannels: input.showSubChannels,
      externalPlayer: input.externalPlayer,
      externalM2tsMode: input.externalM2tsMode,
    },
  };
  return JSON.stringify(file, null, 2);
}

/**
 * テキストが設定 JSON なら parse して返す。違えば null。
 * 生 m3u / EPGStation JSON 配列と誤認しない。
 */
export function parseSettingsFile(text: string): SettingsFile | null {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("{")) return null;

  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    return null;
  }

  if (typeof obj !== "object" || obj === null) return null;
  const rec = obj as Record<string, unknown>;

  if (rec.format !== "mira-web-settings") return null;

  if (rec.version !== 1) {
    throw new Error(
      "この設定ファイルは新しいバージョンです。アプリを更新してください"
    );
  }

  const src = rec.source;
  if (typeof src !== "object" || src === null) return null;
  const srcRec = src as Record<string, unknown>;
  if (srcRec.kind !== "url" && srcRec.kind !== "text") return null;
  if (typeof srcRec.value !== "string") return null;

  return obj as SettingsFile;
}

/** Blob を a[download] でダウンロードさせる */
export function downloadFile(
  filename: string,
  mime: string,
  content: string
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
