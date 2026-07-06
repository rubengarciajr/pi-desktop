// ambient declaration for import.meta.env — populated by electron.vite.config.ts
// from .env (dev) or the matching CI secret (release builds).
interface ImportMetaEnv {
  /** Read-only GitHub PAT baked in at build time to authenticate update checks
   * against the private repo's releases API. Absent in anonymous builds. */
  readonly PI_UPDATE_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
