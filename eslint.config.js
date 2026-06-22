import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      "out/**",
      "dist/**",
      "node_modules/**",
      "build/**",
      "**/*.tsbuildinfo",
      "index.js",
      "*.config.js",
      "*.config.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      // React hooks correctness — the highest-value lint for this codebase
      // (would have caught the uncancelled-timer / missing-dep effects).
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // The SDK bridge is intentionally loosely typed against a pinned SDK.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      // Unused vars are a warning (caught here rather than blocking the build).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // Empty catch blocks are an intentional pattern (best-effort cleanup).
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
);
