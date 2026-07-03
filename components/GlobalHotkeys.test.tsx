// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { create } from "zustand";

// persist middleware を迂回するため、テスト用の簡易 store を注入
interface MockState {
  channels: Array<{ id: string; name: string; group: string; url: string; kind: string }>;
  selectedId: string | null;
  search: string;
  showSubChannels: boolean;
  selectChannel: (id: string) => void;
}

const mockStore = create<MockState>()((set) => ({
  channels: [],
  selectedId: null,
  search: "",
  showSubChannels: true,
  selectChannel: (id: string) => set({ selectedId: id }),
}));

vi.mock("@/lib/store", () => ({ useStore: mockStore }));

// mock 設定の後に import
const { default: GlobalHotkeys } = await import("./GlobalHotkeys");

function fire(key: string, opts?: Partial<KeyboardEventInit>) {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, ...opts })
  );
}

beforeEach(() => {
  mockStore.setState({
    channels: [
      { id: "a", name: "A", group: "GR", url: "http://localhost/a", kind: "mirakurun-mpegts" },
      { id: "b", name: "B", group: "GR", url: "http://localhost/b", kind: "mirakurun-mpegts" },
      { id: "c", name: "C", group: "BS", url: "http://localhost/c", kind: "mirakurun-mpegts" },
    ],
    selectedId: "a",
    search: "",
    showSubChannels: true,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("GlobalHotkeys", () => {
  it("ArrowDown で次のチャンネルを選択する", () => {
    render(<GlobalHotkeys disabled={false} onToggleMute={() => {}} />);
    fire("ArrowDown");
    expect(mockStore.getState().selectedId).toBe("b");
  });

  it("入力欄フォーカス中は無反応", () => {
    render(<GlobalHotkeys disabled={false} onToggleMute={() => {}} />);
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    fire("ArrowDown");
    expect(mockStore.getState().selectedId).toBe("a");
    document.body.removeChild(input);
  });

  it("disabled 時は無反応", () => {
    render(<GlobalHotkeys disabled={true} onToggleMute={() => {}} />);
    fire("ArrowDown");
    expect(mockStore.getState().selectedId).toBe("a");
  });

  it("m キーで onToggleMute が呼ばれる", () => {
    const toggle = vi.fn();
    render(<GlobalHotkeys disabled={false} onToggleMute={toggle} />);
    fire("m");
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it("修飾キー付きは無視", () => {
    render(<GlobalHotkeys disabled={false} onToggleMute={() => {}} />);
    fire("ArrowDown", { metaKey: true });
    expect(mockStore.getState().selectedId).toBe("a");
  });
});
