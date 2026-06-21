import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/renderer/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "var(--color-bg)",
          subtle: "var(--color-bg-subtle)",
          hover: "var(--color-bg-hover)",
          active: "var(--color-bg-active)",
        },
        border: {
          DEFAULT: "var(--color-border)",
          strong: "var(--color-border-strong)",
        },
        text: {
          DEFAULT: "var(--color-text)",
          muted: "var(--color-text-muted)",
          faint: "var(--color-text-faint)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
          subtle: "var(--color-accent-subtle)",
        },
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        thinking: "var(--color-thinking)",
        user: "var(--color-accent)",
        assistant: "var(--color-assistant)",
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
