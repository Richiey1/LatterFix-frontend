/**
 * usePollingFallback Hook
 *
 * Provides graceful fallback to HTTP polling when WebSocket connection fails.
 * Automatically activates when WebSocket is unavailable or disconnected.
 *
 * Features:
 * - Automatic polling on WebSocket failure
 * - Exponential backoff for retries
 * - Configurable polling intervals
 * - Seamless transition between WebSocket and polling modes
 */

import { useCallback, useEffect, useRef } from 'react';
import { useTransactionStore, type TransactionUpdate } from '../stores/transactionStore';
import { pollTransactionStatusBatch } from '../services/pollingService';

export interface PollingConfig {
  enabled?: boolean;
  interval?: number; // Base interval in milliseconds
  maxInterval?: number; // Maximum interval for exponential backoff
  backoffMultiplier?: number;
  maxRetries?: number;
}

const DEFAULT_CONFIG: Required<PollingConfig> = {
  enabled: true,
  interval: 5000, // 5 seconds
  maxInterval: 60000, // 1 minute
  backoffMultiplier: 1.5,
  maxRetries: 10,
};

export interface UsePollingFallbackOptions {
  config?: PollingConfig;
  getSubscribedTransactionIds?: () => string[];
}

export interface UsePollingFallbackReturn {
  isPolling: boolean;
  startPolling: () => void;
  stopPolling: () => void;
  forcePollNow: () => Promise<void>;
}

export function usePollingFallback(
  options: UsePollingFallbackOptions = {}
): UsePollingFallbackReturn {
  const { config: userConfig, getSubscribedTransactionIds } = options;

  const config = { ...DEFAULT_CONFIG, ...userConfig };

  const pollingIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const isPollingRef = useRef(false);

  const {
    wsConnected,
    isPolling,
    setIsPolling,
    updateTransaction,
    setWsReconnecting,
  } = useTransactionStore();

  // Single poll execution with exponential backoff
  const executePoll = useCallback(async () => {
    if (!getSubscribedTransactionIds) {
      return;
    }

    const transactionIds = getSubscribedTransactionIds();
    if (transactionIds.length === 0) {
      return;
    }

    try {
      const updates = await pollTransactionStatusBatch(transactionIds);
      updates.forEach((update) => {
        const txUpdate: TransactionUpdate = {
          transactionId: update.transactionId,
          status: update.status,
          confirmations: update.confirmations,
          hash: update.hash,
          message: update.message,
          timestamp: update.timestamp,
          data: update.data,
        };
        updateTransaction(txUpdate);
      });

      // Reset retry count on successful poll
      retryCountRef.current = 0;
    } catch (error) {
      console.error('Polling error:', error);

      // Exponential backoff
      retryCountRef.current += 1;
      if (retryCountRef.current >= config.maxRetries) {
        console.warn('Max polling retries reached, stopping polling');
        stopPolling();
      }
    }
  }, [getSubscribedTransactionIds, updateTransaction, config.maxRetries]);

  // Calculate current interval with exponential backoff
  const getCurrentInterval = useCallback(() => {
    const backoff = Math.pow(config.backoffMultiplier, retryCountRef.current);
    const interval = config.interval * backoff;
    return Math.min(interval, config.maxInterval);
  }, [config]);

  // Start polling loop
  const startPolling = useCallback(() => {
    if (isPollingRef.current || wsConnected) {
      return;
    }

    isPollingRef.current = true;
    setIsPolling(true);
    retryCountRef.current = 0;
    setWsReconnecting(true);

    const poll = async () => {
      if (!isPollingRef.current) {
        return;
      }

      await executePoll();

      // Schedule next poll
      if (isPollingRef.current && !wsConnected) {
        const interval = getCurrentInterval();
        pollingIntervalRef.current = setTimeout(poll, interval);
      }
    };

    void poll();
  }, [wsConnected, setIsPolling, setWsReconnecting, executePoll, getCurrentInterval]);

  // Stop polling
  const stopPolling = useCallback(() => {
    isPollingRef.current = false;
    setIsPolling(false);

    if (pollingIntervalRef.current) {
      clearTimeout(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    retryCountRef.current = 0;
  }, [setIsPolling]);

  // Force immediate poll (useful for user-initiated refresh)
  const forcePollNow = useCallback(async () => {
    if (!isPollingRef.current) {
      return;
    }

    // Reset backoff on manual refresh
    retryCountRef.current = 0;
    await executePoll();
  }, [executePoll]);

  // Auto-start polling when WebSocket disconnects
  useEffect(() => {
    if (config.enabled && !wsConnected) {
      startPolling();
    } else if (wsConnected) {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [config.enabled, wsConnected, startPolling, stopPolling]);

  return {
    isPolling,
    startPolling,
    stopPolling,
    forcePollNow,
  };
}
