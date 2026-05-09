"use client";

import { useEffect } from "react";

/**
 * iOS Safari PWA standalone モードで初期ロード時に 100dvh が誤った値に
 * 計算され、画面を 1 度回転させると正しい値に治る現象の workaround。
 *
 * window.innerHeight (および visualViewport.height) を `--app-h` という
 * CSS 変数に書き出し、resize / orientationchange / visualViewport.resize
 * すべてに追従させる。CSS 側ではこの変数を優先して height に使う。
 *
 * 効果:
 *   - iOS PWA 初回起動でも下端に余白が浮かない
 *   - キーボード表示や split view 等 viewport が変動しても追従
 */
export default function ViewportHeightFix() {
  useEffect(() => {
    const setHeight = () => {
      // visualViewport があればそれを優先 (iOS の正確な可視領域)
      const vv = window.visualViewport;
      const h = vv ? vv.height : window.innerHeight;
      document.documentElement.style.setProperty("--app-h", `${h}px`);
    };

    setHeight();
    // iOS PWA は初期化が遅れるケースがあるので軽く再評価
    const t1 = setTimeout(setHeight, 100);
    const t2 = setTimeout(setHeight, 500);

    window.addEventListener("resize", setHeight);
    window.addEventListener("orientationchange", setHeight);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", setHeight);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", setHeight);
      window.removeEventListener("orientationchange", setHeight);
      if (vv) {
        vv.removeEventListener("resize", setHeight);
      }
    };
  }, []);

  return null;
}
