/**
 * Environment variables Vite exposes to the client. Only `VITE_`-prefixed
 * names reach the bundle, which is the point: no secret belongs here.
 */
interface ImportMetaEnv {
  /** `mock` (default) or `live`. See src/api/index.ts. */
  readonly VITE_API_MODE?: 'mock' | 'live';
  /**
   * Which corpus live mode asks. Both or neither — the backend only honours
   * the pair. Unset means the backend picks, which today is the demo corpus.
   * Names of datasets, not credentials. See src/api/live/mcp.ts.
   */
  readonly VITE_KA_TENANT?: string;
  readonly VITE_KA_DATASET_CONFIG_KEY?: string;
  /**
   * How fast mock mode answers: `fast`, `realistic` (default) or `slow`.
   * See `mockSpeeds` in src/api/mock/MockChatClient.ts.
   */
  readonly VITE_MOCK_SPEED?: 'fast' | 'realistic' | 'slow';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
