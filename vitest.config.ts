import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Vite 6+ ネイティブ対応 — tsconfig.json の paths (@/* など) を解決
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/**/*.ts"],
      exclude: ["lib/**/*.test.ts"],
    },
  },
});
