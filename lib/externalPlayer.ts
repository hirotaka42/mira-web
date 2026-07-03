import type { Channel } from "./types";

export type ExternalPlayerKind = "infuse" | "vlc";
export type MobilePlatform = "ios" | "android" | "other";

/** UA と maxTouchPoints から判定する純関数 (テスト用に引数注入) */
export function detectPlatformFrom(
  ua: string,
  maxTouchPoints: number
): MobilePlatform {
  if (/iPhone|iPod|iPad/i.test(ua)) return "ios";
  // iPadOS 13+ は Mac UA を返す → maxTouchPoints で検出
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

/** navigator から読む薄いラッパ */
export function detectPlatform(): MobilePlatform {
  if (typeof navigator === "undefined") return "other";
  return detectPlatformFrom(
    navigator.userAgent,
    navigator.maxTouchPoints ?? 0
  );
}

/**
 * チャンネルから外部アプリに渡すストリーム URL。変換不能なら null。
 *
 * - mirakurun-mpegts: channel.url をそのまま返す
 * - epgstation-hls: /api/streams/live/{id}/hls → /api/streams/live/{id}/m2ts?mode={m2tsMode}
 *   (EPGStation の m2ts エンドポイントは接続クローズで自動停止・keep 不要)
 */
export function externalStreamUrl(
  channel: Channel,
  m2tsMode: number
): string | null {
  if (channel.kind === "mirakurun-mpegts") return channel.url;

  if (channel.kind === "epgstation-hls") {
    let parsed: URL;
    try {
      parsed = new URL(channel.url);
    } catch {
      return null;
    }
    const match = parsed.pathname.match(
      /^\/api\/streams\/live\/(\d+)\/hls$/
    );
    if (!match) return null;
    const id = match[1];
    return `${parsed.origin}/api/streams/live/${id}/m2ts?mode=${m2tsMode}`;
  }

  return null;
}

/**
 * 外部プレイヤーアプリの URL スキームを組み立てる。
 * 対応プラットフォーム以外は null を返す。
 */
export function buildExternalPlayerUrl(
  streamUrl: string,
  player: ExternalPlayerKind,
  platform: MobilePlatform
): string | null {
  const encoded = encodeURIComponent(streamUrl);

  if (platform === "ios") {
    if (player === "infuse") {
      return `infuse://x-callback-url/play?url=${encoded}`;
    }
    return `vlc-x-callback://x-callback-url/stream?url=${encoded}`;
  }

  if (platform === "android") {
    // Android は VLC intent を使用 (Infuse は Android 非対応)。
    // package=org.videolan.vlc を外すと OS の汎用チューザーに委ねられる
    // (EPGStation 既定はこの形)。
    const u = new URL(streamUrl);
    return `intent://${u.host}${u.pathname}${u.search}#Intent;action=android.intent.action.VIEW;type=video/*;scheme=${u.protocol.replace(":", "")};package=org.videolan.vlc;end`;
  }

  return null;
}
