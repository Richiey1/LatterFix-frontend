/**
 * useHorizonAccount
 *
 * React hook that loads and caches a Stellar account's balances, subentry
 * count, and sequence number directly from Horizon. Provides live balance
 * queries for XLM, USDC, and EURC on the connected wallet.
 *
 * Automatically refreshes when the connected address changes or on demand.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  loadAccount,
  hasTrustline,
  StellarAccountInfo,
  StellarAccountBalance,
} from '../services/stellar';

// Well-known Stellar asset issuers
export const KNOWN_ISSUERS = {
  // Centre / Circle USDC on testnet (canonical testnet anchor)
  USDC: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  // EURC issuer on testnet
  EURC: 'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP',
} as const;

export type SupportedToken = 'XLM' | 'USDC' | 'EURC';

export interface AccountBalances {
  XLM: string;
  USDC: string;
  EURC: string;
}

export interface UseHorizonAccountReturn {
  accountInfo: StellarAccountInfo | null;
  balances: AccountBalances;
  allBalances: StellarAccountBalance[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getBalance: (token: SupportedToken) => string;
  checkTrustline: (assetCode: string, issuer: string) => Promise<boolean>;
  accountExists: boolean;
}

const EMPTY_BALANCES: AccountBalances = {
  XLM: '0.0000000',
  USDC: '0.0000000',
  EURC: '0.0000000',
};

function extractBalances(balanceList: StellarAccountBalance[]): AccountBalances {
  const result = { ...EMPTY_BALANCES };

  for (const b of balanceList) {
    if (b.isNative) {
      result.XLM = b.balance;
    } else if (b.assetCode === 'USDC') {
      result.USDC = b.balance;
    } else if (b.assetCode === 'EURC') {
      result.EURC = b.balance;
    }
  }

  return result;
}

export function useHorizonAccount(address: string | null): UseHorizonAccountReturn {
  const [accountInfo, setAccountInfo] = useState<StellarAccountInfo | null>(null);
  const [balances, setBalances] = useState<AccountBalances>(EMPTY_BALANCES);
  const [allBalances, setAllBalances] = useState<StellarAccountBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) {
      setAccountInfo(null);
      setBalances(EMPTY_BALANCES);
      setAllBalances([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const info = await loadAccount(address);
      setAccountInfo(info);
      setAllBalances(info.balances);
      setBalances(extractBalances(info.balances));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load account';
      // Unfunded accounts return 404 — treat gracefully
      if (message.includes('404') || message.includes('Not Found')) {
        setError('Account not yet funded on this network. Send XLM to activate it.');
      } else {
        setError(message);
      }
      setAccountInfo(null);
      setBalances(EMPTY_BALANCES);
      setAllBalances([]);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getBalance = useCallback(
    (token: SupportedToken): string => balances[token] ?? '0.0000000',
    [balances]
  );

  const checkTrustline = useCallback(
    async (assetCode: string, issuer: string): Promise<boolean> => {
      if (!address) return false;
      return hasTrustline(address, assetCode, issuer);
    },
    [address]
  );

  return {
    accountInfo,
    balances,
    allBalances,
    isLoading,
    error,
    refresh,
    getBalance,
    checkTrustline,
    accountExists: !!accountInfo,
  };
}
