/**
 * useRealTimeUpdates Hook
 *
 * Unified hook that combines WebSocket updates with polling fallback.
 * Provides seamless real-time updates regardless of connection status.
 *
 * Features:
 * - Automatic WebSocket subscription management
 * - Graceful fallback to HTTP polling
 * - Efficient, atomized state updates via Zustand
 * - Real-time notifications for payment milestones
 */

import { useCallback, useEffect } from 'react';
import { useTransactionUpdates } from './useTransactionUpdates';
import { usePollingFallback } from './usePollingFallback';
import type {
  TransactionUpdate,
  PaymentMilestone,
  BalanceUpdate,
} from '../stores/transactionStore';

export interface UseRealTimeUpdatesOptions {
  enablePollingFallback?: boolean;
  showNotifications?: boolean;
  pollingInterval?: number;
}

export interface UseRealTimeUpdatesReturn {
  // Connection state
  isConnected: boolean;
  isPolling: boolean;
  isReconnecting: boolean;

  // Transaction state
  transactions: Map<string, TransactionUpdate>;
  milestones: PaymentMilestone[];
  balanceUpdates: BalanceUpdate[];

  // Actions
  subscribeToTransaction: (transactionId: string) => void;
  unsubscribeFromTransaction: (transactionId: string) => void;
  getTransactionStatus: (id: string) => TransactionUpdate | undefined;
  clearMilestones: () => void;
  forceRefresh: () => Promise<void>;
}

export function useRealTimeUpdates(
  options: UseRealTimeUpdatesOptions = {}
): UseRealTimeUpdatesReturn {
  const {
    enablePollingFallback = true,
    showNotifications = true,
    pollingInterval = 5000,
  } = options;

  // Get WebSocket-based transaction updates
  const {
    wsConnected,
    wsReconnecting,
    isPolling,
    transactions,
    milestones,
    balanceUpdates,
    subscribe,
    unsubscribe,
    getTransaction,
    getSubscribedTransactionIds,
    clearMilestones,
  } = useTransactionUpdates({
    showNotifications,
  });

  // Set up polling fallback
  const { forcePollNow, startPolling } = usePollingFallback({
    config: {
      enabled: enablePollingFallback,
      interval: pollingInterval,
    },
    getSubscribedTransactionIds,
  });

  // Connection status derived from WebSocket and polling state
  const isConnected = wsConnected || isPolling;
  const isReconnecting = wsReconnecting;

  // Subscribe to transaction updates
  const subscribeToTransaction = useCallback(
    (transactionId: string) => {
      subscribe(transactionId);

      // If WebSocket is not connected, immediately poll for status
      if (!wsConnected && enablePollingFallback) {
        startPolling();
      }
    },
    [subscribe, wsConnected, enablePollingFallback, startPolling]
  );

  // Unsubscribe from transaction updates
  const unsubscribeFromTransaction = useCallback(
    (transactionId: string) => {
      unsubscribe(transactionId);
    },
    [unsubscribe]
  );

  // Force refresh via polling
  const forceRefresh = useCallback(async () => {
    if (!wsConnected) {
      await forcePollNow();
    }
  }, [wsConnected, forcePollNow]);

  // Auto-start polling when WebSocket disconnects
  useEffect(() => {
    if (enablePollingFallback && !wsConnected) {
      startPolling();
    }
  }, [enablePollingFallback, wsConnected, startPolling]);

  return {
    isConnected,
    isPolling,
    isReconnecting,
    transactions,
    milestones,
    balanceUpdates,
    subscribeToTransaction,
    unsubscribeFromTransaction,
    getTransactionStatus: getTransaction,
    clearMilestones,
    forceRefresh,
  };
}
