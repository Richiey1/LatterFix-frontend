/**
 * Transaction Status Store
 *
 * Zustand store for managing real-time transaction status updates.
 * Provides efficient, atomized state updates for React components.
 *
 * Features:
 * - Transaction status tracking (pending, confirmed, failed)
 * - On-chain confirmation count tracking
 * - Balance change notifications
 * - Payment milestone tracking
 */

import { create } from 'zustand';

export type TransactionStatus = 'pending' | 'submitted' | 'confirming' | 'confirmed' | 'failed';

export interface TransactionUpdate {
  transactionId: string;
  status: TransactionStatus;
  confirmations?: number;
  hash?: string;
  message?: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface PaymentMilestone {
  id: string;
  type:
    | 'payment_initiated'
    | 'payment_submitted'
    | 'payment_confirming'
    | 'payment_confirmed'
    | 'payment_failed';
  transactionId: string;
  amount?: string;
  asset?: string;
  recipient?: string;
  confirmations?: number;
  requiredConfirmations?: number;
  timestamp: string;
}

export interface BalanceUpdate {
  address: string;
  asset: string;
  oldBalance: string;
  newBalance: string;
  change: string;
  transactionId?: string;
  timestamp: string;
}

interface TransactionState {
  // Transaction statuses
  transactions: Map<string, TransactionUpdate>;

  // Payment milestones for real-time notifications
  milestones: PaymentMilestone[];

  // Balance updates
  balanceUpdates: BalanceUpdate[];

  // Connection state for WebSocket status
  wsConnected: boolean;
  wsReconnecting: boolean;
  isPolling: boolean;

  // Actions
  updateTransaction: (update: TransactionUpdate) => void;
  getTransaction: (id: string) => TransactionUpdate | undefined;
  removeTransaction: (id: string) => void;
  clearTransactions: () => void;

  addMilestone: (milestone: PaymentMilestone) => void;
  clearMilestones: () => void;
  getMilestonesForTransaction: (transactionId: string) => PaymentMilestone[];

  addBalanceUpdate: (update: BalanceUpdate) => void;
  clearBalanceUpdates: () => void;

  setWsConnected: (connected: boolean) => void;
  setWsReconnecting: (reconnecting: boolean) => void;
  setIsPolling: (polling: boolean) => void;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: new Map(),
  milestones: [],
  balanceUpdates: [],
  wsConnected: false,
  wsReconnecting: false,
  isPolling: false,

  updateTransaction: (update) => {
    set((state) => {
      const newTransactions = new Map(state.transactions);
      newTransactions.set(update.transactionId, update);
      return { transactions: newTransactions };
    });
  },

  getTransaction: (id) => {
    return get().transactions.get(id);
  },

  removeTransaction: (id) => {
    set((state) => {
      const newTransactions = new Map(state.transactions);
      newTransactions.delete(id);
      return { transactions: newTransactions };
    });
  },

  clearTransactions: () => {
    set({ transactions: new Map() });
  },

  addMilestone: (milestone) => {
    set((state) => ({
      milestones: [...state.milestones, milestone],
    }));
  },

  clearMilestones: () => {
    set({ milestones: [] });
  },

  getMilestonesForTransaction: (transactionId) => {
    return get().milestones.filter((m) => m.transactionId === transactionId);
  },

  addBalanceUpdate: (update) => {
    set((state) => ({
      balanceUpdates: [...state.balanceUpdates, update],
    }));
  },

  clearBalanceUpdates: () => {
    set({ balanceUpdates: [] });
  },

  setWsConnected: (connected) => {
    set({ wsConnected: connected, wsReconnecting: false });
  },

  setWsReconnecting: (reconnecting) => {
    set({ wsReconnecting: reconnecting });
  },

  setIsPolling: (polling) => {
    set({ isPolling: polling });
  },
}));
