/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_USE_API_MOCKS: string;
  /** Virtual-host name sent as `Host` by the native HTTP adapter (see api/client.ts). */
  readonly VITE_API_HOST_HEADER?: string;
  readonly VITE_ECHO_HOST: string;
  readonly VITE_ECHO_KEY: string;

  /** `monnify` selects the real gateway; anything else falls back to the mock. */
  readonly VITE_PAYMENT_PROVIDER?: string;
  /**
   * Public merchant identifiers only. The Monnify *secret* key must never be a
   * `VITE_` variable — those are inlined into the shipped bundle.
   */
  readonly VITE_MONNIFY_API_KEY?: string;
  readonly VITE_MONNIFY_CONTRACT_CODE?: string;
  /** `LIVE` moves real money; anything else stays on the Monnify sandbox. */
  readonly VITE_MONNIFY_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
