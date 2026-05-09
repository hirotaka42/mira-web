export type ChannelGroup = "GR" | "BS" | "CS" | string;

/**
 * チャンネル URL の種別。プレイヤー選択に使う。
 *   - mirakurun-mpegts: 生 MPEG-TS 直リン (ts-live.js + WebGPU で復号)
 *   - epgstation-hls:   EPGStation の HLS 起動 RPC URL
 *                       (起動 → /streamfiles/stream{N}.m3u8 polling → <video>)
 */
export type ChannelKind = "mirakurun-mpegts" | "epgstation-hls";

export interface Channel {
  id: string;
  name: string;
  group: ChannelGroup;
  url: string;
  kind: ChannelKind;
  tvgId?: string;
  logo?: string;
}

export type M3uSourceKind = "text" | "url";

export interface M3uSource {
  kind: M3uSourceKind;
  value: string;
  fetchedAt?: number;
}

export interface PlaybackStats {
  resolution?: string;
  bitrate?: number;
  codec?: string;
  buffer?: number;
  dropped?: number;
}
