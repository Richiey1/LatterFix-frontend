import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useNotification } from '../hooks/useNotification';
import { SocketContext } from '../hooks/useSocket';
import { useNetwork } from '../hooks/useNetwork';
import { useTransactionStore } from '../stores/transactionStore';

// Type for bulk confirmation payload
interface BulkConfirmationPayload {
  batchId: string;
  confirmations: number;
  status?: string;
  timestamp?: string;
}

// Assuming backend is running on port 3000
const SOCKET_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';

// WebSocket connection configuration
const SOCKET_CONFIG = {
  withCredentials: true,
  transports: ['websocket', 'polling'], // Allow fallback to polling
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const { notifySuccess, notifyError } = useNotification();
  const { network } = useNetwork();
  const subscribedIds = useRef<Set<string>>(new Set());
  const isFirstNetworkRun = useRef(true);
  const reconnectAttempts = useRef(0);

  // Access store for polling fallback trigger
  const { setIsPolling, setWsConnected, setWsReconnecting } = useTransactionStore();

  useEffect(() => {
    const newSocket = io(SOCKET_URL, SOCKET_CONFIG);

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setConnected(true);
      setWsConnected(true);
      reconnectAttempts.current = 0;
      setIsPolling(false);
      notifySuccess('Real-time updates connected');

      // Re-subscribe to all tracked transactions after reconnection
      subscribedIds.current.forEach((id) => {
        newSocket.emit('subscribe:transaction', id);
      });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setConnected(false);
      setWsConnected(false);

      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        newSocket.connect();
      }

      notifyError('Real-time updates disconnected');
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setConnected(false);
      setWsConnected(false);
      reconnectAttempts.current += 1;

      // Enable polling fallback after max reconnection attempts
      if (reconnectAttempts.current >= SOCKET_CONFIG.reconnectionAttempts) {
        console.warn('WebSocket connection failed, enabling polling fallback');
        setIsPolling(true);
        notifyError('WebSocket unavailable, using polling fallback');
      }
    });

    // Handle bulk payment confirmation events
    const handleBulkConfirmation = (data: BulkConfirmationPayload) => {
      // Dispatch custom event for components listening to bulk updates
      window.dispatchEvent(
        new CustomEvent('bulk:confirmation', {
          detail: data,
        })
      );
    };

    newSocket.on('bulk:confirmation', handleBulkConfirmation);
    newSocket.on('bulk_payment:confirmation', handleBulkConfirmation);

    newSocket.io.on('reconnect_attempt', (attempt) => {
      console.log(`Reconnection attempt ${attempt}`);
      setWsReconnecting(true);
    });

    newSocket.io.on('reconnect', (attempt) => {
      console.log(`Reconnected after ${attempt} attempts`);
      setWsReconnecting(false);
      notifySuccess('Real-time updates restored');
    });

    newSocket.io.on('reconnect_failed', () => {
      console.error('Reconnection failed');
      setWsReconnecting(false);
      setIsPolling(true);
      notifyError('Unable to reconnect, using polling fallback');
    });

    return () => {
      newSocket.off('bulk:confirmation', handleBulkConfirmation);
      newSocket.off('bulk_payment:confirmation', handleBulkConfirmation);
      newSocket.disconnect();
    };
  }, [notifySuccess, notifyError, setIsPolling, setWsConnected, setWsReconnecting]);

  const subscribeToTransaction = useCallback(
    (transactionId: string) => {
      if (socket && connected) {
        socket.emit('subscribe:transaction', transactionId);
        subscribedIds.current.add(transactionId);
      }
    },
    [socket, connected]
  );

  const unsubscribeFromTransaction = useCallback(
    (transactionId: string) => {
      if (socket && connected) {
        socket.emit('unsubscribe:transaction', transactionId);
      }
      subscribedIds.current.delete(transactionId);
    },
    [socket, connected]
  );

  const resetSubscriptions = useCallback(() => {
    if (socket && connected) {
      subscribedIds.current.forEach((id) => socket.emit('unsubscribe:transaction', id));
    }
    subscribedIds.current.clear();
  }, [socket, connected]);

  // Network switch (#085): stale per-transaction subscriptions no longer
  // apply once contract IDs/RPC endpoints resolve to a different network.
  useEffect(() => {
    if (isFirstNetworkRun.current) {
      isFirstNetworkRun.current = false;
      return;
    }
    resetSubscriptions();
  }, [network, resetSubscriptions]);

  return (
    <SocketContext
      value={{
        socket,
        connected,
        subscribeToTransaction,
        unsubscribeFromTransaction,
        resetSubscriptions,
      }}
    >
      {children}
    </SocketContext>
  );
};
