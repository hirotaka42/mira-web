export type ChannelGroup = "GR" | "BS" | "CS" | string;

export interface Channel {
  id: string;
  name: string;
  group: ChannelGroup;
  url: string;
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
