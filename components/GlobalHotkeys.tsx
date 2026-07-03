"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { adjacentChannelId, visibleChannels } from "@/lib/channelNav";

interface Props {
  disabled: boolean;
  onToggleMute: () => void;
}

export default function GlobalHotkeys({ disabled, onToggleMute }: Props) {
  useEffect(() => {
    if (disabled) return;

    function handler(e: KeyboardEvent) {
      // 修飾キー付きは無視
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // 入力欄ガード
      const el = document.activeElement;
      if (el) {
        const tag = el.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if ((el as HTMLElement).isContentEditable) return;
      }

      const state = useStore.getState();
      const list = visibleChannels(
        state.channels,
        state.search,
        state.showSubChannels
      );

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const next = adjacentChannelId(list, state.selectedId, 1);
          if (next) state.selectChannel(next);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prev = adjacentChannelId(list, state.selectedId, -1);
          if (prev) state.selectChannel(prev);
          break;
        }
        case "/": {
          e.preventDefault();
          document
            .querySelector<HTMLInputElement>("[data-search-input]")
            ?.focus();
          break;
        }
        case "f": {
          window.dispatchEvent(new CustomEvent("mira:toggle-fullscreen"));
          break;
        }
        case "m": {
          onToggleMute();
          break;
        }
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [disabled, onToggleMute]);

  return null;
}
