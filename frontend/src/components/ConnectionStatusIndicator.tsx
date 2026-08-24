/**
 * Connection Status Indicator Component
 *
 * Displays real-time connection status for WebSocket and polling fallback.
 * Shows visual indicator when in polling mode or reconnecting.
 */

import React from 'react';
import { useTransactionStore } from '../stores/transactionStore';
import { Wifi, WifiOff, RefreshCw, Radio } from 'lucide-react';

export const ConnectionStatusIndicator: React.FC = () => {
  const { wsConnected, wsReconnecting, isPolling } = useTransactionStore();

  // Determine connection status
  const getConnectionStatus = () => {
    if (wsConnected) {
      return {
        icon: <Wifi className="w-4 h-4" />,
        text: 'Live Updates',
        colorClass: 'text-green-400',
        bgClass: 'bg-green-400/10',
      };
    }

    if (wsReconnecting) {
      return {
        icon: <RefreshCw className="w-4 h-4 animate-spin" />,
        text: 'Reconnecting...',
        colorClass: 'text-yellow-400',
        bgClass: 'bg-yellow-400/10',
      };
    }

    if (isPolling) {
      return {
        icon: <Radio className="w-4 h-4" />,
        text: 'Polling Mode',
        colorClass: 'text-blue-400',
        bgClass: 'bg-blue-400/10',
      };
    }

    return {
      icon: <WifiOff className="w-4 h-4" />,
      text: 'Disconnected',
      colorClass: 'text-red-400',
      bgClass: 'bg-red-400/10',
    };
  };

  const status = getConnectionStatus();

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${status.colorClass} ${status.bgClass}`}
      title={
        wsConnected
          ? 'WebSocket connected'
          : isPolling
            ? 'Using HTTP polling fallback'
            : 'Connection lost'
      }
    >
      {status.icon}
      <span>{status.text}</span>
    </div>
  );
};
