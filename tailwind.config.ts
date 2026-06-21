import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/renderer/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        // Neutral, modern dark palette inspired by the reference apps.
        bg: {
          DEFAULT: "#0f0f10",
          subtle: "#161617",
          hover: "#1d1d1f",
          active: "#242426",
        },
        border: {
          DEFAULT: "#262629",
          strong: "#34343a",
        },
        text: {
          DEFAULT: "#e8e8ea",
          muted: "#8e8e94",
          faint: "#5e5e64",
        },
        accent: {
          DEFAULT: "#7c5cff",
          hover: "#8e6dff",
          subtle: "rgba(124, 92, 255, 0.12)",
        },
        success: "#3dd68c",
        warning: "#ffb454",
        danger: "#ff6b6b",
        thinking: "#9ba1d4",
        user: "#7c5cff",
        assistant: "#e8e8ea",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "SF Mono",
          "JetBrains Mono",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      animation: {
        "pulse-subtle": "pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fade-in 0.15s ease-out",
        "slide-up": "slide-up 0.2s ease-out",
      },
      keyframes: {
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
