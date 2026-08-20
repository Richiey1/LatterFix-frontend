import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('networkConfig', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to testnet outside production when nothing is stored', async () => {
    vi.stubEnv('MODE', 'development');
    const { getActiveNetwork } = await import('../networkConfig');
    expect(getActiveNetwork()).toBe('testnet');
  });

  it('defaults to mainnet in production when nothing is stored', async () => {
    vi.stubEnv('MODE', 'production');
    const { getActiveNetwork } = await import('../networkConfig');
    expect(getActiveNetwork()).toBe('mainnet');
  });

  it('prefers a persisted localStorage preference over the mode default', async () => {
    localStorage.setItem('payd:network', 'mainnet');
    vi.stubEnv('MODE', 'development');
    const { getActiveNetwork } = await import('../networkConfig');
    expect(getActiveNetwork()).toBe('mainnet');
  });

  it('setActiveNetwork updates the module-level active network', async () => {
    vi.stubEnv('MODE', 'development');
    const { getActiveNetwork, setActiveNetwork } = await import('../networkConfig');
    setActiveNetwork('mainnet');
    expect(getActiveNetwork()).toBe('mainnet');
  });

  it('returns the static Horizon/RPC/passphrase defaults per network', async () => {
    const { getNetworkEndpoints } = await import('../networkConfig');
    expect(getNetworkEndpoints('testnet').horizonUrl).toBe('https://horizon-testnet.stellar.org');
    expect(getNetworkEndpoints('mainnet').horizonUrl).toBe('https://horizon.stellar.org');
    expect(getNetworkEndpoints('testnet').networkPassphrase).not.toBe(
      getNetworkEndpoints('mainnet').networkPassphrase
    );
  });

  it('applies PUBLIC_STELLAR_* overrides only for the matching network', async () => {
    vi.stubEnv('PUBLIC_STELLAR_NETWORK', 'TESTNET');
    vi.stubEnv('PUBLIC_STELLAR_HORIZON_URL', 'http://localhost:8000');
    const { getNetworkEndpoints } = await import('../networkConfig');

    expect(getNetworkEndpoints('testnet').horizonUrl).toBe('http://localhost:8000');
    expect(getNetworkEndpoints('mainnet').horizonUrl).toBe('https://horizon.stellar.org');
  });
});
