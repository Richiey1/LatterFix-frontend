import { createContext, use } from 'react';
import type { NetworkType } from '../services/contracts.types';

export interface NetworkContextType {
  network: NetworkType;
  setNetwork: (network: NetworkType) => void;
  isMainnet: boolean;
  isSwitching: boolean;
}

export const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const useNetwork = () => {
  const context = use(NetworkContext);
  if (!context) throw new Error('useNetwork must be used within NetworkProvider');
  return context;
};
