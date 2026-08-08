/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_USE_API_MOCKS: string;
  readonly VITE_ECHO_HOST: string;
  readonly VITE_ECHO_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
