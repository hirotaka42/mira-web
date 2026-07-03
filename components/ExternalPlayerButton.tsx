"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Channel } from "@/lib/types";
import type { MobilePlatform } from "@/lib/externalPlayer";
import {
  detectPlatform,
  externalStreamUrl,
  buildExternalPlayerUrl,
} from "@/lib/externalPlayer";

interface Props {
  channel: Channel | null;
}

export default function ExternalPlayerButton({ channel }: Props) {
  // hydration 差異回避: マウント後に判定
  const [platform, setPlatform] = useState<MobilePlatform>("other");
  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const externalPlayer = useStore((s) => s.externalPlayer);
  const m2tsMode = useStore((s) => s.externalM2tsMode);

  if (platform === "other" || !channel) return null;

  const streamUrl = externalStreamUrl(channel, m2tsMode);
  if (!streamUrl) return null;

  const playerUrl = buildExternalPlayerUrl(streamUrl, externalPlayer, platform);
  if (!playerUrl) return null;

  // Android は常に VLC (Infuse は Android 非対応)
  const label =
    platform === "android"
      ? "アプリで開く (VLC)"
      : `アプリで開く (${externalPlayer === "infuse" ? "Infuse" : "VLC"})`;

  return (
    <a
      href={playerUrl}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/60 rounded-md transition-colors"
    >
      <ExternalLink size={13} />
      {label}
    </a>
  );
}
