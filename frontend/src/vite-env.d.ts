/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_VESTING_TOKEN_CONTRACT_ID?: string;
  readonly VITE_VESTING_ESCROW_CONTRACT_ID?: string;
  readonly PUBLIC_STELLAR_RPC_URL?: string;
  readonly PUBLIC_STELLAR_NETWORK?: string;
  readonly PUBLIC_STELLAR_HORIZON_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
