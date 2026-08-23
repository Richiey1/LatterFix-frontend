/**
 * useTransactionUpdates Hook
 *
 * Hook for subscribing to real-time transaction status updates via WebSocket.
 * Provides efficient, atomized state updates using Zustand store.
 *
 * Features:
 * - Automatic subscription to transaction updates
 * - Real-time confirmation tracking
 * - Payment milestone notifications
 * - Balance change notifications
 */

import { useCallback, useEffect, useRef } from 'react';
import { useSocket } from './useSocket';
import { useNotification } from './useNotification';
import {
  useTransactionStore,
  type TransactionUpdate,
  type PaymentMilestone,
  type BalanceUpdate,
} from '../stores/transactionStore';

export interface UseTransactionUpdatesOptions {
  autoSubscribe?: boolean;
  showNotifications?: boolean;
  notificationTypes?: ('milestone' | 'balance' | 'status')[];
}

export interface UseTransactionUpdatesReturn {
  // State from store
  wsConnected: boolean;
  wsReconnecting: boolean;
  isPolling: boolean;

  // Transaction state
  transactions: Map<string, TransactionUpdate>;
  milestones: PaymentMilestone[];
  balanceUpdates: BalanceUpdate[];

  // Actions
  subscribe: (transactionId: string) => void;
  unsubscribe: (transactionId: string) => void;
  getTransaction: (id: string) => TransactionUpdate | undefined;
  getSubscribedTransactionIds: () => string[];
  clearMilestones: () => void;
}

// Track all subscribed transaction IDs globally for polling fallback
const globalSubscriptions = new Set<string>();

export function useTransactionUpdates(
  options: UseTransactionUpdatesOptions = {}
): UseTransactionUpdatesReturn {
  const { showNotifications = true } = options;

  const { socket, connected } = useSocket();
  const { notifySuccess, notifyError } = useNotification();
  const subscribedIds = useRef<Set<string>>(new Set());

  // Store state and actions
  const {
    transactions,
    milestones,
    balanceUpdates,
    wsConnected,
    wsReconnecting,
    isPolling,
    updateTransaction,
    getTransaction,
    addMilestone,
    clearMilestones,
    addBalanceUpdate,
    setWsConnected,
  } = useTransactionStore();

  // Update connection status
  useEffect(() => {
    setWsConnected(connected);
  }, [connected, setWsConnected]);

  // Handle WebSocket events
  useEffect(() => {
    if (!socket) return;

    // Transaction status updates
    const handleTransactionUpdate = (data: TransactionUpdate) => {
      updateTransaction(data);

      if (showNotifications) {
        if (data.status === 'confirmed') {
          notifySuccess('Transaction Confirmed', data.message || 'Your transaction has been confirmed on-chain');
        } else if (data.status === 'failed') {
          notifyError('Transaction Failed', data.message || 'Your transaction could not be processed');
        }
      }
    };

    // Payment milestone updates
    const handlePaymentMilestone = (data: PaymentMilestone) => {
      addMilestone(data);

      if (showNotifications && data.type !== 'payment_initiated') {
        const milestoneMessages: Record<PaymentMilestone['type'], string> = {
          payment_initiated: 'Payment initiated',
          payment_submitted: 'Payment submitted to network',
          payment_confirming: `Payment confirming (${data.confirmations}/${data.requiredConfirmations} confirmations)`,
          payment_confirmed: 'Payment confirmed!',
          payment_failed: 'Payment failed',
        };

        if (data.type === 'payment_confirmed') {
          notifySuccess('Payment Confirmed', milestoneMessages[data.type]);
        } else if (data.type === 'payment_failed') {
          notifyError('Payment Failed', milestoneMessages[data.type]);
        }
      }
    };

    // Balance updates
    const handleBalanceUpdate = (data: BalanceUpdate) => {
      addBalanceUpdate(data);

      if (showNotifications) {
        const changeSign = parseFloat(data.change) >= 0 ? '+' : '';
        notifySuccess(
          'Balance Updated',
          `${data.asset}: ${changeSign}${data.change}`
        );
      }
    };

    // Confirmation updates
    const handleConfirmationUpdate = (data: {
      transactionId: string;
      confirmations: number;
      requiredConfirmations?: number;
    }) => {
      const existing = getTransaction(data.transactionId);
      if (existing) {
        updateTransaction({
          ...existing,
          confirmations: data.confirmations,
          status: data.confirmations >= (data.requiredConfirmations || 1) ? 'confirmed' : 'confirming',
        });
      }
    };

    // Register event listeners
    socket.on('transaction:update', handleTransactionUpdate);
    socket.on('transaction:status', handleTransactionUpdate);
    socket.on('payment:milestone', handlePaymentMilestone);
    socket.on('balance:update', handleBalanceUpdate);
    socket.on('transaction:confirmation', handleConfirmationUpdate);

    return () => {
      socket.off('transaction:update', handleTransactionUpdate);
      socket.off('transaction:status', handleTransactionUpdate);
      socket.off('payment:milestone', handlePaymentMilestone);
      socket.off('balance:update', handleBalanceUpdate);
      socket.off('transaction:confirmation', handleConfirmationUpdate);
    };
  }, [
    socket,
    showNotifications,
    notifySuccess,
    notifyError,
    updateTransaction,
    addMilestone,
    addBalanceUpdate,
    getTransaction,
  ]);

  // Subscribe to transaction updates
  const subscribe = useCallback(
    (transactionId: string) => {
      if (socket && connected) {
        socket.emit('subscribe:transaction', transactionId);
        subscribedIds.current.add(transactionId);
        globalSubscriptions.add(transactionId);
      }
    },
    [socket, connected]
  );

  // Unsubscribe from transaction updates
  const unsubscribe = useCallback(
    (transactionId: string) => {
      if (socket && connected) {
        socket.emit('unsubscribe:transaction', transactionId);
      }
      subscribedIds.current.delete(transactionId);
      globalSubscriptions.delete(transactionId);
    },
    [socket, connected]
  );

  // Get all subscribed transaction IDs (for polling fallback)
  const getSubscribedTransactionIds = useCallback(() => {
    return Array.from(globalSubscriptions);
  }, []);

  return {
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
  };
}
