import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { NetworkProvider } from '../NetworkProvider';
import { useNetwork } from '../../hooks/useNetwork';

const mocks = vi.hoisted(() => ({
  refreshRegistry: vi.fn<() => Promise<void>>(),
  notify: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock('../../hooks/useNotification', () => ({
  useNotification: () => ({
    notify: mocks.notify,
    notifySuccess: vi.fn(),
    notifyError: mocks.notifyError,
  }),
}));

vi.mock('../../services/contracts', () => ({
  contractService: { refreshRegistry: mocks.refreshRegistry },
}));

describe('NetworkProvider / useNetwork', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.refreshRegistry.mockResolvedValue(undefined);
  });

  it('does not refresh the contract registry on initial mount', () => {
    renderHook(() => useNetwork(), { wrapper: NetworkProvider });
    expect(mocks.refreshRegistry).not.toHaveBeenCalled();
  });

  it('switching networks persists the choice and refreshes the registry', async () => {
    const { result } = renderHook(() => useNetwork(), { wrapper: NetworkProvider });
    const initial = result.current.network;
    const target = initial === 'mainnet' ? 'testnet' : 'mainnet';

    await act(async () => {
      result.current.setNetwork(target);
      await Promise.resolve();
    });

    expect(result.current.network).toBe(target);
    expect(result.current.isMainnet).toBe(target === 'mainnet');
    expect(localStorage.getItem('payd:network')).toBe(target);
    expect(mocks.refreshRegistry).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when switching to the currently active network', async () => {
    const { result } = renderHook(() => useNetwork(), { wrapper: NetworkProvider });
    const initial = result.current.network;

    await act(async () => {
      result.current.setNetwork(initial);
      await Promise.resolve();
    });

    expect(mocks.refreshRegistry).not.toHaveBeenCalled();
  });

  it('surfaces a notification error when the registry refresh fails', async () => {
    mocks.refreshRegistry.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useNetwork(), { wrapper: NetworkProvider });
    const target = result.current.network === 'mainnet' ? 'testnet' : 'mainnet';

    await act(async () => {
      result.current.setNetwork(target);
      await Promise.resolve();
    });

    expect(mocks.notifyError).toHaveBeenCalledWith('Contract registry refresh failed', 'network down');
  });
});
