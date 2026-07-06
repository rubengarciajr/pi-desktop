import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/renderer/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "rgb(var(--color-bg-rgb) / <alpha-value>)",
          subtle: "rgb(var(--color-bg-subtle-rgb) / <alpha-value>)",
          hover: "rgb(var(--color-bg-hover-rgb) / <alpha-value>)",
          active: "rgb(var(--color-bg-active-rgb) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--color-border-rgb) / <alpha-value>)",
          strong: "rgb(var(--color-border-strong-rgb) / <alpha-value>)",
        },
        text: {
          DEFAULT: "rgb(var(--color-text-rgb) / <alpha-value>)",
          muted: "rgb(var(--color-text-muted-rgb) / <alpha-value>)",
          faint: "rgb(var(--color-text-faint-rgb) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--color-accent-rgb) / <alpha-value>)",
          hover: "rgb(var(--color-accent-hover-rgb) / <alpha-value>)",
          subtle: "rgb(var(--color-accent-rgb) / 0.12)",
        },
        success: "rgb(var(--color-success-rgb) / <alpha-value>)",
        warning: "rgb(var(--color-warning-rgb) / <alpha-value>)",
        danger: "rgb(var(--color-danger-rgb) / <alpha-value>)",
        thinking: "rgb(var(--color-thinking-rgb) / <alpha-value>)",
        user: "rgb(var(--color-accent-rgb) / <alpha-value>)",
        assistant: "rgb(var(--color-text-rgb) / <alpha-value>)",
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
        glow: "glow 2s ease-in-out infinite",
        "glow-accent": "glow-accent 2.4s ease-in-out infinite",
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
        // Pulsing halo for the GitHub badge when the working tree has changes
        // that need syncing.
        glow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgb(var(--color-warning-rgb) / 0)" },
          "50%": { boxShadow: "0 0 10px 2px rgb(var(--color-warning-rgb) / 0.55)" },
        },
        // Accent-colored pulse on the prompt input when a chat/code session is
        // fresh (empty) — draws the eye to where the user should type.
        "glow-accent": {
          "0%, 100%": {
            boxShadow: "0 0 0 0 rgb(var(--color-accent-rgb) / 0)",
            borderColor: "rgb(var(--color-border-rgb))",
          },
          "50%": {
            boxShadow: "0 0 14px 2px rgb(var(--color-accent-rgb) / 0.45)",
            borderColor: "rgb(var(--color-accent-rgb) / 0.6)",
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
