import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Load .env so PI_UPDATE_TOKEN (a read-only GitHub PAT for the private repo's
  // releases API) is available at build time via import.meta.env. The file is
  // gitignored; CI injects it via the secret of the same name.
  const env = loadEnv(mode, process.cwd(), "PI_");

  return {
  main: {
    define: {
      // Bake the update-check PAT into the main bundle at build time so
      // updateToken.ts can read it via import.meta.env. JSON-encoded so empty
      // values become the literal `undefined`, never the string "undefined".
      "import.meta.env.PI_UPDATE_TOKEN": JSON.stringify(env.PI_UPDATE_TOKEN ?? ""),
    },
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
      // Electron 38 ships Chromium ~128; targeting it directly skips needlessly
      // transpiling modern syntax that the runtime already understands.
      target: "chrome128",
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        input: { index: resolve(__dirname, "src/renderer/index.html") },
        output: {
          // Split heavy vendor deps into their own chunks so they cache
          // independently and parse in parallel, instead of one giant blob.
          manualChunks: {
            "vendor-react": ["react", "react-dom"],
            "vendor-markdown": ["react-markdown", "remark-gfm", "react-syntax-highlighter"],
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
  };
});
