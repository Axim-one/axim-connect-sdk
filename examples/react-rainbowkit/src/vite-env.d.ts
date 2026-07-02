// Self-contained env typing (avoids a hard dependency on `vite/client` types).
interface ImportMetaEnv {
  readonly VITE_WC_PROJECT_ID?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
