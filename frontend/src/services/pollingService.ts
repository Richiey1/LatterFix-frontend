/**
 * Polling Service
 *
 * Provides HTTP-based polling for transaction status updates when WebSocket
 * connection is unavailable. Used as a graceful fallback mechanism.
 *
 * Features:
 * - REST API polling for transaction status
 * - Batch status checking
 * - Compatible with backend transaction endpoints
 */

import axios from 'axios';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000';

export interface TransactionStatusResponse {
  transactionId: string;
  status: 'pending' | 'submitted' | 'confirming' | 'confirmed' | 'failed';
  confirmations?: number;
  hash?: string;
  message?: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

/**
 * Poll for status of a single transaction
 */
export async function pollTransactionStatus(
  transactionId: string
): Promise<TransactionStatusResponse> {
  const response = await axios.get<TransactionStatusResponse>(
    `${API_BASE_URL}/api/transactions/${transactionId}/status`
  );
  return response.data;
}

/**
 * Batch poll for status of multiple transactions
 * More efficient than individual polls when checking multiple transactions
 */
export async function pollTransactionStatusBatch(
  transactionIds: string[]
): Promise<TransactionStatusResponse[]> {
  if (transactionIds.length === 0) {
    return [];
  }

  // If backend supports batch endpoint, use it
  // Otherwise, fall back to individual requests
  try {
    const response = await axios.post<TransactionStatusResponse[]>(
      `${API_BASE_URL}/api/transactions/status/batch`,
      { transactionIds }
    );
    return response.data;
  } catch (_error) {
    // Batch endpoint not available, fall back to individual requests
    console.warn('Batch status endpoint unavailable, using individual requests');
    
    const results = await Promise.allSettled(
      transactionIds.map((id) => pollTransactionStatus(id))
    );

    return results
      .filter((r): r is PromiseFulfilledResult<TransactionStatusResponse> => 
        r.status === 'fulfilled'
      )
      .map((r) => r.value);
  }
}

/**
 * Poll for balance updates for an account
 */
export async function pollAccountBalance(
  address: string
): Promise<{
  address: string;
  balances: Array<{
    asset: string;
    balance: string;
  }>;
  timestamp: string;
}> {
  const response = await axios.get<{
    address: string;
    balances: Array<{ asset: string; balance: string }>;
    timestamp: string;
  }>(
    `${API_BASE_URL}/api/accounts/${address}/balance`
  );
  return response.data;
}

/**
 * Poll for payment milestone updates
 */
export async function pollPaymentMilestones(
  transactionId: string
): Promise<Array<{
  id: string;
  type: string;
  transactionId: string;
  timestamp: string;
  data?: Record<string, unknown>;
}>> {
  const response = await axios.get<Array<{
    id: string;
    type: string;
    transactionId: string;
    timestamp: string;
    data?: Record<string, unknown>;
  }>>(
    `${API_BASE_URL}/api/transactions/${transactionId}/milestones`
  );
  return response.data;
}
