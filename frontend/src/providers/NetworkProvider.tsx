import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NetworkContext } from '../hooks/useNetwork';
import { useNotification } from '../hooks/useNotification';
import { contractService } from '../services/contracts';
import {
  ACTIVE_NETWORK_STORAGE_KEY,
  getActiveNetwork,
  setActiveNetwork,
} from '../services/networkConfig';
import type { NetworkType } from '../services/contracts.types';

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [network, setNetworkState] = useState<NetworkType>(getActiveNetwork);
  const [isSwitching, setIsSwitching] = useState(false);
  const isFirstRun = useRef(true);
  const { notify, notifyError } = useNotification();

  useEffect(() => {
    setActiveNetwork(network);
    localStorage.setItem(ACTIVE_NETWORK_STORAGE_KEY, network);

    // Skip the reset/refresh cycle on initial mount — only real switches
    // should clear cached state and re-fetch the registry.
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    setIsSwitching(true);
    contractService
      .refreshRegistry()
      .then(() => {
        notify(`Switched to ${network === 'mainnet' ? 'Mainnet' : 'Testnet'}`);
      })
      .catch((error) => {
        notifyError(
          'Contract registry refresh failed',
          error instanceof Error
            ? error.message
            : 'Could not refresh contracts for the new network.'
        );
      })
      .finally(() => setIsSwitching(false));
  }, [network, notify, notifyError]);

  const setNetwork = useCallback((next: NetworkType) => {
    setNetworkState((prev) => (prev === next ? prev : next));
  }, []);

  return (
    <NetworkContext
      value={{
        network,
        setNetwork,
        isMainnet: network === 'mainnet',
        isSwitching,
      }}
    >
      {children}
    </NetworkContext>
  );
};
