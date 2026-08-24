import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { SocketProvider } from '../SocketProvider';
import { useSocket } from '../../hooks/useSocket';
import { useTransactionStore } from '../../stores/transactionStore';

// Mock socket.io-client
const mockSocket = {
  id: 'socket-123',
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connect: vi.fn(),
  io: {
    on: vi.fn(),
    off: vi.fn(),
  },
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

// Mock notification hook
const mockNotifySuccess = vi.fn();
const mockNotifyError = vi.fn();
const mockNotify = vi.fn();

vi.mock('../../hooks/useNotification', () => ({
  useNotification: () => ({
    notifySuccess: mockNotifySuccess,
    notifyError: mockNotifyError,
    notify: mockNotify,
  }),
}));

// Mock network hook
vi.mock('../../hooks/useNetwork', () => ({
  useNetwork: () => ({
    network: 'testnet',
    setNetwork: vi.fn(),
    isMainnet: false,
    isSwitching: false,
  }),
}));

describe('SocketProvider', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SocketProvider>{children}</SocketProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it('should provide socket context', () => {
    const { result } = renderHook(() => useSocket(), { wrapper });
    expect(result.current).toBeDefined();
    expect(result.current.socket).toBeDefined();
    expect(result.current.connected).toBeDefined();
  });

  it('should initialize socket connection on mount', () => {
    renderHook(() => useSocket(), { wrapper });

    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
  });

  it('should update connection state on connect', async () => {
    const { result } = renderHook(() => useSocket(), { wrapper });

    // Simulate connect event
    const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1];

    act(() => {
      connectHandler?.();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    // Check store state
    expect(useTransactionStore.getState().wsConnected).toBe(true);
    expect(useTransactionStore.getState().isPolling).toBe(false);
  });

  it('should update connection state on disconnect', async () => {
    const { result } = renderHook(() => useSocket(), { wrapper });

    // First connect
    const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1];
    act(() => {
      void connectHandler?.();
    });

    // Then disconnect
    const disconnectHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'disconnect'
    )?.[1];
    act(() => {
      void disconnectHandler?.('transport close');
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(false);
    });

    expect(useTransactionStore.getState().wsConnected).toBe(false);
  });

  it('should subscribe to transaction updates', async () => {
    const { result } = renderHook(() => useSocket(), { wrapper });

    // Connect first
    const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1];
    act(() => {
      void connectHandler?.();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    // Subscribe to transaction
    act(() => {
      result.current.subscribeToTransaction('tx-123');
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:transaction', 'tx-123');
  });

  it('should unsubscribe from transaction updates', async () => {
    const { result } = renderHook(() => useSocket(), { wrapper });

    // Connect first
    const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1];
    act(() => {
      void connectHandler?.();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    // Subscribe and unsubscribe
    act(() => {
      result.current.subscribeToTransaction('tx-123');
      result.current.unsubscribeFromTransaction('tx-123');
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe:transaction', 'tx-123');
  });

  it('should enable polling fallback after max reconnection attempts', async () => {
    renderHook(() => useSocket(), { wrapper });

    // Simulate multiple connection errors
    const errorHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect_error')?.[1];

    // Simulate 10 connection errors
    for (let i = 0; i < 10; i++) {
      act(() => {
        void errorHandler?.(new Error('Connection failed'));
      });
    }

    await waitFor(() => {
      expect(useTransactionStore.getState().isPolling).toBe(true);
    });
  });

  it('should cleanup socket on unmount', () => {
    const { unmount } = renderHook(() => useSocket(), { wrapper });

    unmount();

    expect(mockSocket.disconnect).toHaveBeenCalled();
  });
});
