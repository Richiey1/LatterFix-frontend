import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useTransactionStore } from '../transactionStore';

describe('transactionStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useTransactionStore.setState({
      transactions: new Map(),
      milestones: [],
      balanceUpdates: [],
      wsConnected: false,
      wsReconnecting: false,
      isPolling: false,
    });
  });

  describe('transaction updates', () => {
    it('should add a new transaction', () => {
      act(() => {
        useTransactionStore.getState().updateTransaction({
          transactionId: 'tx-123',
          status: 'pending',
          timestamp: '2024-01-01T00:00:00Z',
        });
      });

      const state = useTransactionStore.getState();
      expect(state.transactions.size).toBe(1);
      expect(state.transactions.get('tx-123')?.status).toBe('pending');
    });

    it('should update an existing transaction', () => {
      act(() => {
        useTransactionStore.getState().updateTransaction({
          transactionId: 'tx-123',
          status: 'pending',
          timestamp: '2024-01-01T00:00:00Z',
        });
      });

      act(() => {
        useTransactionStore.getState().updateTransaction({
          transactionId: 'tx-123',
          status: 'confirmed',
          confirmations: 5,
          timestamp: '2024-01-01T00:01:00Z',
        });
      });

      const state = useTransactionStore.getState();
      const tx = state.transactions.get('tx-123');
      expect(tx?.status).toBe('confirmed');
      expect(tx?.confirmations).toBe(5);
    });

    it('should remove a transaction', () => {
      act(() => {
        useTransactionStore.getState().updateTransaction({
          transactionId: 'tx-123',
          status: 'pending',
          timestamp: '2024-01-01T00:00:00Z',
        });
      });

      act(() => {
        useTransactionStore.getState().removeTransaction('tx-123');
      });

      const state = useTransactionStore.getState();
      expect(state.transactions.size).toBe(0);
    });

    it('should clear all transactions', () => {
      act(() => {
        useTransactionStore.getState().updateTransaction({
          transactionId: 'tx-1',
          status: 'pending',
          timestamp: '2024-01-01T00:00:00Z',
        });
        useTransactionStore.getState().updateTransaction({
          transactionId: 'tx-2',
          status: 'confirmed',
          timestamp: '2024-01-01T00:01:00Z',
        });
      });

      act(() => {
        useTransactionStore.getState().clearTransactions();
      });

      const state = useTransactionStore.getState();
      expect(state.transactions.size).toBe(0);
    });

    it('should get a transaction by id', () => {
      act(() => {
        useTransactionStore.getState().updateTransaction({
          transactionId: 'tx-123',
          status: 'pending',
          timestamp: '2024-01-01T00:00:00Z',
        });
      });

      const tx = useTransactionStore.getState().getTransaction('tx-123');
      expect(tx?.status).toBe('pending');
    });
  });

  describe('payment milestones', () => {
    it('should add a payment milestone', () => {
      act(() => {
        useTransactionStore.getState().addMilestone({
          id: 'ms-1',
          type: 'payment_submitted',
          transactionId: 'tx-123',
          timestamp: '2024-01-01T00:00:00Z',
        });
      });

      const state = useTransactionStore.getState();
      expect(state.milestones.length).toBe(1);
      expect(state.milestones[0].type).toBe('payment_submitted');
    });

    it('should clear all milestones', () => {
      act(() => {
        useTransactionStore.getState().addMilestone({
          id: 'ms-1',
          type: 'payment_submitted',
          transactionId: 'tx-123',
          timestamp: '2024-01-01T00:00:00Z',
        });
      });

      act(() => {
        useTransactionStore.getState().clearMilestones();
      });

      const state = useTransactionStore.getState();
      expect(state.milestones.length).toBe(0);
    });

    it('should get milestones for a specific transaction', () => {
      act(() => {
        useTransactionStore.getState().addMilestone({
          id: 'ms-1',
          type: 'payment_submitted',
          transactionId: 'tx-123',
          timestamp: '2024-01-01T00:00:00Z',
        });
        useTransactionStore.getState().addMilestone({
          id: 'ms-2',
          type: 'payment_confirmed',
          transactionId: 'tx-123',
          timestamp: '2024-01-01T00:01:00Z',
        });
        useTransactionStore.getState().addMilestone({
          id: 'ms-3',
          type: 'payment_submitted',
          transactionId: 'tx-456',
          timestamp: '2024-01-01T00:02:00Z',
        });
      });

      const milestones = useTransactionStore.getState().getMilestonesForTransaction('tx-123');
      expect(milestones.length).toBe(2);
      expect(milestones.every((m) => m.transactionId === 'tx-123')).toBe(true);
    });
  });

  describe('balance updates', () => {
    it('should add a balance update', () => {
      act(() => {
        useTransactionStore.getState().addBalanceUpdate({
          address: 'GABC123',
          asset: 'USDC',
          oldBalance: '100.00',
          newBalance: '150.00',
          change: '50.00',
          timestamp: '2024-01-01T00:00:00Z',
        });
      });

      const state = useTransactionStore.getState();
      expect(state.balanceUpdates.length).toBe(1);
      expect(state.balanceUpdates[0].asset).toBe('USDC');
    });

    it('should clear all balance updates', () => {
      act(() => {
        useTransactionStore.getState().addBalanceUpdate({
          address: 'GABC123',
          asset: 'USDC',
          oldBalance: '100.00',
          newBalance: '150.00',
          change: '50.00',
          timestamp: '2024-01-01T00:00:00Z',
        });
      });

      act(() => {
        useTransactionStore.getState().clearBalanceUpdates();
      });

      const state = useTransactionStore.getState();
      expect(state.balanceUpdates.length).toBe(0);
    });
  });

  describe('connection state', () => {
    it('should set WebSocket connected state', () => {
      act(() => {
        useTransactionStore.getState().setWsConnected(true);
      });

      const state = useTransactionStore.getState();
      expect(state.wsConnected).toBe(true);
      expect(state.wsReconnecting).toBe(false);
    });

    it('should set WebSocket reconnecting state', () => {
      act(() => {
        useTransactionStore.getState().setWsReconnecting(true);
      });

      const state = useTransactionStore.getState();
      expect(state.wsReconnecting).toBe(true);
    });

    it('should set polling state', () => {
      act(() => {
        useTransactionStore.getState().setIsPolling(true);
      });

      const state = useTransactionStore.getState();
      expect(state.isPolling).toBe(true);
    });
  });
});
