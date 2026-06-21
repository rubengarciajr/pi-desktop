import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: [] })],
    resolve: {
      // Pi ships ESM; mark its packages as bundled (not externalized) so the
      // main process can require/import them directly.
      conditions: ["node", "import"],
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "src/main/index.ts") },
        external: [
          "electron",
          "@earendil-works/pi-coding-agent",
          "@earendil-works/pi-ai",
          "@earendil-works/pi-agent-core",
          "@earendil-works/pi-tui",
        ],
      },
      target: "node20",
      outDir: "out/main",
    },
  },
  preload: {
    plugins: [],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "src/preload/index.ts") },
        external: ["electron"],
      },
      target: "node20",
      outDir: "out/preload",
    },
  },
  renderer: {
    root: "src/renderer",
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "src/renderer/index.html") },
      },
      outDir: "out/renderer",
    },
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
        "@shared": resolve("src/shared"),
      },
    },
    plugins: [react()],
  },
});
