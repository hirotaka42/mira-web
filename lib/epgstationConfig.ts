import type { Channel } from "./types";
import { buildFetchInit, validateUrl } from "./safeFetch";
import { getEpgstationOrigin } from "./presets";

export interface M2tsModeInfo {
  name: string;
  isUnconverted?: boolean;
}

/**
 * /api/config のレスポンス JSON から m2ts プリセット一覧を取り出す純関数。
 * streamConfig.live.ts.m2ts が「name: string を持つオブジェクトの非空配列」なら返す。
 * 形が想定外なら null。
 */
export function parseM2tsModes(json: unknown): M2tsModeInfo[] | null {
  if (typeof json !== "object" || json === null) return null;
  const root = json as Record<string, unknown>;
  const sc = root.streamConfig;
  if (typeof sc !== "object" || sc === null) return null;
  const live = (sc as Record<string, unknown>).live;
  if (typeof live !== "object" || live === null) return null;
  const ts = (live as Record<string, unknown>).ts;
  if (typeof ts !== "object" || ts === null) return null;
  const m2ts = (ts as Record<string, unknown>).m2ts;
  if (!Array.isArray(m2ts) || m2ts.length === 0) return null;

  const result: M2tsModeInfo[] = [];
  for (const item of m2ts) {
    if (typeof item !== "object" || item === null) return null;
    const obj = item as Record<string, unknown>;
    if (typeof obj.name !== "string") return null;
    result.push({
      name: obj.name,
      ...(typeof obj.isUnconverted === "boolean"
        ? { isUnconverted: obj.isUnconverted }
        : {}),
    });
  }
  return result;
}

/**
 * origin の /api/config を取得して parse する。
 * 失敗 (ネットワーク/CORS/形不一致) は null を返す。
 */
export async function fetchM2tsModes(
  origin: string
): Promise<M2tsModeInfo[] | null> {
  try {
    const url = new URL("/api/config", origin);
    const { url: validatedUrl } = validateUrl(url.toString());
    const res = await fetch(
      validatedUrl.toString(),
      buildFetchInit(validatedUrl)
    );
    if (!res.ok) return null;
    const json: unknown = await res.json();
    return parseM2tsModes(json);
  } catch {
    return null;
  }
}

/**
 * チャンネル一覧から EPGStation の origin を推定する。
 * 最初の epgstation-hls チャンネルの URL origin を返す。無ければ null。
 */
export function epgstationOrigin(channels: Channel[]): string | null {
  for (const ch of channels) {
    if (ch.kind === "epgstation-hls") {
      try {
        return new URL(ch.url).origin;
      } catch {
        continue;
      }
    }
  }
  return null;
}

/** channels から EPGStation origin を導出し、無ければプリセットへフォールバック */
export function resolveEpgstationOrigin(
  channels: Channel[]
): string | null {
  return epgstationOrigin(channels) ?? getEpgstationOrigin();
}
