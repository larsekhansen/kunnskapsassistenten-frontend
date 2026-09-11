/**
 * Environment variables Vite exposes to the client. Only `VITE_`-prefixed
 * names reach the bundle, which is the point: no secret belongs here.
 */
interface ImportMetaEnv {
  /** `mock` (default) or `live`. See src/api/index.ts. */
  readonly VITE_API_MODE?: 'mock' | 'live';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
