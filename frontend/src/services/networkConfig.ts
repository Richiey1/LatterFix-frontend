/**
 * Network Configuration
 *
 * Single source of truth for resolving Horizon URLs, Soroban RPC endpoints,
 * and network passphrases for the two supported Stellar networks (testnet,
 * mainnet). Backs the runtime network switcher (admin panel + developer
 * debug page): flipping the active network here is what makes every
 * contract call, balance query, and wallet signature target the right
 * network without a rebuild.
 *
 * `PUBLIC_STELLAR_*` env vars (see .env.example) remain supported as a local
 * dev override — e.g. pointing testnet at a local stellar-quickstart
 * instance — but no longer hardcode which network the app runs against.
 */

import { Networks } from '@stellar/stellar-sdk';
import type { NetworkType } from './contracts.types';

export interface NetworkEndpoints {
  horizonUrl: string;
  rpcUrl: string;
  networkPassphrase: string;
}

const NETWORK_ENDPOINTS: Record<NetworkType, NetworkEndpoints> = {
  testnet: {
    horizonUrl: 'https://horizon-testnet.stellar.org',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: Networks.TESTNET,
  },
  mainnet: {
    horizonUrl: 'https://horizon.stellar.org',
    // Community-run public endpoint; override with PUBLIC_STELLAR_RPC_URL for
    // production reliability (e.g. a dedicated RPC provider).
    rpcUrl: 'https://mainnet.sorobanrpc.com',
    networkPassphrase: Networks.PUBLIC,
  },
};

/** Maps the build-time `PUBLIC_STELLAR_NETWORK` env var to a NetworkType, if set. */
function getEnvOverrideNetwork(): NetworkType | null {
  const raw = (import.meta.env.PUBLIC_STELLAR_NETWORK as string | undefined)?.toUpperCase();
  if (raw === 'MAINNET') return 'mainnet';
  if (raw === 'TESTNET' || raw === 'LOCAL') return 'testnet';
  return null;
}

/**
 * Resolves the Horizon/RPC/passphrase endpoints for a given network.
 * When the requested network matches the build's `PUBLIC_STELLAR_NETWORK`
 * env var, any configured `PUBLIC_STELLAR_*` overrides take precedence
 * (this is what lets local/standalone dev setups keep working).
 */
export function getNetworkEndpoints(network: NetworkType): NetworkEndpoints {
  const base = NETWORK_ENDPOINTS[network];

  if (getEnvOverrideNetwork() === network) {
    const envHorizon = import.meta.env.PUBLIC_STELLAR_HORIZON_URL as string | undefined;
    const envRpc = import.meta.env.PUBLIC_STELLAR_RPC_URL as string | undefined;
    const envPassphrase = import.meta.env.PUBLIC_STELLAR_NETWORK_PASSPHRASE as string | undefined;

    return {
      horizonUrl: (envHorizon || base.horizonUrl).replace(/\/+$/, ''),
      rpcUrl: (envRpc || base.rpcUrl).replace(/\/+$/, ''),
      networkPassphrase: envPassphrase || base.networkPassphrase,
    };
  }

  return base;
}

const ACTIVE_NETWORK_STORAGE_KEY = 'payd:network';

function computeDefaultNetwork(): NetworkType {
  const stored =
    typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_NETWORK_STORAGE_KEY) : null;
  if (stored === 'testnet' || stored === 'mainnet') return stored;
  // Mainnet is the safe default for production builds; local/dev builds
  // default to testnet so engineers don't accidentally target real funds.
  return import.meta.env.MODE === 'production' ? 'mainnet' : 'testnet';
}

let activeNetwork: NetworkType = computeDefaultNetwork();

/**
 * Returns the currently active network. Non-React services (stellar.ts,
 * useSorobanContract.ts) read this directly so they stay in sync with
 * NetworkProvider without needing to be React components themselves.
 */
export function getActiveNetwork(): NetworkType {
  return activeNetwork;
}

/** Updates the module-level active network. Called by NetworkProvider on switch. */
export function setActiveNetwork(network: NetworkType): void {
  activeNetwork = network;
}

export { ACTIVE_NETWORK_STORAGE_KEY };
