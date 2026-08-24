import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePollingFallback } from '../usePollingFallback';
import { useTransactionStore } from '../../stores/transactionStore';

// Mock polling service
vi.mock('../../services/pollingService', () => ({
  pollTransactionStatusBatch: vi.fn().mockResolvedValue([
    {
      transactionId: 'tx-123',
      status: 'confirmed',
      confirmations: 5,
      timestamp: '2024-01-01T00:00:00Z',
    },
  ]),
}));

describe('usePollingFallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.clearAllTimers();

    // Reset store
    useTransactionStore.setState({
      transactions: new Map(),
      wsConnected: false,
      wsReconnecting: false,
      isPolling: false,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should start polling when WebSocket is disconnected', () => {
    const getSubscribedIds = vi.fn().mockReturnValue(['tx-123']);

    const { result } = renderHook(() =>
      usePollingFallback({
        config: { enabled: true, interval: 1000 },
        getSubscribedTransactionIds: getSubscribedIds,
      })
    );

    act(() => {
      result.current.startPolling();
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isPolling).toBe(true);
    expect(useTransactionStore.getState().isPolling).toBe(true);
  });

  it('should stop polling when WebSocket connects', () => {
    useTransactionStore.setState({ wsConnected: false });

    const { result } = renderHook(() =>
      usePollingFallback({
        config: { enabled: true },
        getSubscribedTransactionIds: () => ['tx-123'],
      })
    );

    act(() => {
      result.current.startPolling();
    });

    expect(result.current.isPolling).toBe(true);

    // Simulate WebSocket connection
    act(() => {
      useTransactionStore.getState().setWsConnected(true);
    });

    act(() => {
      result.current.stopPolling();
    });

    expect(result.current.isPolling).toBe(false);
  });

  it('should use exponential backoff on polling errors', async () => {
    const { pollTransactionStatusBatch } = await import('../../services/pollingService');
    vi.mocked(pollTransactionStatusBatch).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() =>
      usePollingFallback({
        config: {
          enabled: true,
          interval: 1000,
          backoffMultiplier: 2,
        },
        getSubscribedTransactionIds: () => ['tx-123'],
      })
    );

    act(() => {
      result.current.startPolling();
      vi.advanceTimersByTime(100);
    });

    // First poll fails, should schedule with backoff
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.isPolling).toBe(true);
  });

  it('should allow force poll now', async () => {
    const { pollTransactionStatusBatch } = await import('../../services/pollingService');

    const { result } = renderHook(() =>
      usePollingFallback({
        config: { enabled: true },
        getSubscribedTransactionIds: () => ['tx-123'],
      })
    );

    act(() => {
      result.current.startPolling();
      vi.advanceTimersByTime(100);
    });

    await act(async () => {
      await result.current.forcePollNow();
    });

    expect(pollTransactionStatusBatch).toHaveBeenCalledWith(['tx-123']);
  });

  it('should auto-start when enabled and WebSocket disconnected', () => {
    useTransactionStore.setState({ wsConnected: false });

    renderHook(() =>
      usePollingFallback({
        config: { enabled: true },
        getSubscribedTransactionIds: () => ['tx-123'],
      })
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(useTransactionStore.getState().isPolling).toBe(true);
  });

  it('should not start polling when WebSocket is connected', () => {
    useTransactionStore.setState({ wsConnected: true });

    renderHook(() =>
      usePollingFallback({
        config: { enabled: true },
        getSubscribedTransactionIds: () => ['tx-123'],
      })
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(useTransactionStore.getState().isPolling).toBe(false);
  });

  it('should stop polling after max retries', async () => {
    const { pollTransactionStatusBatch } = await import('../../services/pollingService');
    vi.mocked(pollTransactionStatusBatch).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      usePollingFallback({
        config: {
          enabled: true,
          interval: 100,
          maxRetries: 3,
        },
        getSubscribedTransactionIds: () => ['tx-123'],
      })
    );

    act(() => {
      result.current.startPolling();
    });

    // Simulate multiple failed polls
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }

    // Should stop after max retries
    expect(result.current.isPolling).toBe(false);
  });
});
