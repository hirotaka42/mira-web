import type { MetadataRoute } from "next";

// `output: "export"` 環境では静的生成を明示する必要がある (Next.js 16)
export const dynamic = "force-static";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mira WebUI",
    short_name: "Mira",
    description:
      "Mira WebUI — a static, browser-only IPTV viewer for Mirakurun / EPGStation",
    // basePath を含めないと iOS が「ホームに追加」したとき root に飛んでしまう
    start_url: `${BASE_PATH}/`,
    scope: `${BASE_PATH}/`,
    display: "standalone",
    orientation: "any",
    background_color: "#0f172a", // slate-900
    theme_color: "#0891b2", // cyan-600
    icons: [
      {
        // app/icon.png として書き出される (Next.js Convention)
        src: `${BASE_PATH}/icon.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${BASE_PATH}/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${BASE_PATH}/icon-maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
