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
        output: {
          // The preload runs under `sandbox: true` (see src/main/window.ts),
          // whose restricted loader does NOT support ESM `import` — it must be
          // CommonJS. The `.cjs` entry below keeps it loadable despite the
          // package-level `"type": "module"`.
          format: "cjs",
          entryFileNames: "index.cjs",
        },
      },
      target: "node20",
      outDir: "out/preload",
    },
  },
  renderer: {
    root: "src/renderer",
    build: {
      // Electron 41 ships Chromium 146; targeting it directly skips needlessly
      // transpiling modern syntax that the runtime already understands.
      target: "chrome146",
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        input: { index: resolve(__dirname, "src/renderer/index.html") },
        output: {
          // Split heavy vendor deps into their own chunks so they cache
          // independently and parse in parallel, instead of one giant blob.
          manualChunks: {
            "vendor-react": ["react", "react-dom"],
            "vendor-markdown": ["react-markdown", "remark-gfm"],
            "vendor-syntax": ["react-syntax-highlighter"],
          },
        },
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
