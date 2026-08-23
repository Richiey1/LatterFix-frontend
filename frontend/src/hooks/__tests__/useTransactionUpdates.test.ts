import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useTransactionUpdates } from '../useTransactionUpdates';
import { useTransactionStore } from '../../stores/transactionStore';

// Mock socket context
const mockSocket = {
  id: 'socket-123',
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  io: {
    on: vi.fn(),
    off: vi.fn(),
  },
};

vi.mock('../useSocket', () => ({
  useSocket: () => ({
    socket: mockSocket,
    connected: true,
  }),
}));

vi.mock('../useNotification', () => ({
  useNotification: () => ({
    notifySuccess: vi.fn(),
    notifyError: vi.fn(),
    notify: vi.fn(),
  }),
}));

describe('useTransactionUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store
    useTransactionStore.setState({
      transactions: new Map(),
      milestones: [],
      balanceUpdates: [],
      wsConnected: true,
      wsReconnecting: false,
      isPolling: false,
    });
  });

  it('should return connection state', () => {
    const { result } = renderHook(() => useTransactionUpdates());

    expect(result.current.wsConnected).toBe(true);
    expect(result.current.wsReconnecting).toBe(false);
    expect(result.current.isPolling).toBe(false);
  });

  it('should subscribe to transaction updates', () => {
    const { result } = renderHook(() => useTransactionUpdates());

    act(() => {
      result.current.subscribe('tx-123');
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:transaction', 'tx-123');
  });

  it('should unsubscribe from transaction updates', () => {
    const { result } = renderHook(() => useTransactionUpdates());

    act(() => {
      result.current.subscribe('tx-123');
      result.current.unsubscribe('tx-123');
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe:transaction', 'tx-123');
  });

  it('should handle transaction status updates', async () => {
    renderHook(() => useTransactionUpdates());

    // Get the transaction update handler
    const txUpdateHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'transaction:update'
    )?.[1];

    act(() => {
      txUpdateHandler?.({
        transactionId: 'tx-123',
        status: 'confirmed',
        timestamp: '2024-01-01T00:00:00Z',
      });
    });

    await waitFor(() => {
      const tx = useTransactionStore.getState().getTransaction('tx-123');
      expect(tx?.status).toBe('confirmed');
    });
  });

  it('should handle payment milestone updates', async () => {
    renderHook(() => useTransactionUpdates());

    // Get the milestone handler
    const milestoneHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'payment:milestone'
    )?.[1];

    act(() => {
      milestoneHandler?.({
        id: 'ms-1',
        type: 'payment_confirmed',
        transactionId: 'tx-123',
        timestamp: '2024-01-01T00:00:00Z',
      });
    });

    await waitFor(() => {
      const milestones = useTransactionStore.getState().milestones;
      expect(milestones.length).toBe(1);
      expect(milestones[0].type).toBe('payment_confirmed');
    });
  });

  it('should handle balance updates', async () => {
    renderHook(() => useTransactionUpdates());

    // Get the balance update handler
    const balanceHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'balance:update'
    )?.[1];

    act(() => {
      balanceHandler?.({
        address: 'GABC123',
        asset: 'USDC',
        oldBalance: '100.00',
        newBalance: '150.00',
        change: '50.00',
        timestamp: '2024-01-01T00:00:00Z',
      });
    });

    await waitFor(() => {
      const updates = useTransactionStore.getState().balanceUpdates;
      expect(updates.length).toBe(1);
      expect(updates[0].asset).toBe('USDC');
    });
  });

  it('should handle confirmation updates', async () => {
    // Setup initial transaction
    useTransactionStore.getState().updateTransaction({
      transactionId: 'tx-123',
      status: 'confirming',
      confirmations: 0,
      timestamp: '2024-01-01T00:00:00Z',
    });

    renderHook(() => useTransactionUpdates());

    // Get the confirmation handler
    const confirmHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'transaction:confirmation'
    )?.[1];

    act(() => {
      confirmHandler?.({
        transactionId: 'tx-123',
        confirmations: 5,
        requiredConfirmations: 5,
      });
    });

    await waitFor(() => {
      const tx = useTransactionStore.getState().getTransaction('tx-123');
      expect(tx?.confirmations).toBe(5);
      expect(tx?.status).toBe('confirmed');
    });
  });

  it('should clear milestones', async () => {
    const { result } = renderHook(() => useTransactionUpdates());

    // Add a milestone
    const milestoneHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'payment:milestone'
    )?.[1];

    act(() => {
      milestoneHandler?.({
        id: 'ms-1',
        type: 'payment_confirmed',
        transactionId: 'tx-123',
        timestamp: '2024-01-01T00:00:00Z',
      });
    });

    await waitFor(() => {
      expect(useTransactionStore.getState().milestones.length).toBe(1);
    });

    // Clear milestones
    act(() => {
      result.current.clearMilestones();
    });

    expect(useTransactionStore.getState().milestones.length).toBe(0);
  });

  it('should get subscribed transaction ids', () => {
    const { result } = renderHook(() => useTransactionUpdates());

    act(() => {
      result.current.subscribe('tx-1');
      result.current.subscribe('tx-2');
    });

    const ids = result.current.getSubscribedTransactionIds();
    expect(ids).toContain('tx-1');
    expect(ids).toContain('tx-2');
  });
});
