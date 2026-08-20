import { Loader2, Globe, FlaskConical } from 'lucide-react';
import { useNetwork } from '../hooks/useNetwork';
import type { NetworkType } from '../services/contracts.types';

interface NetworkSwitcherProps {
  className?: string;
}

/**
 * Runtime testnet/mainnet toggle. Used in the Admin Panel and the developer
 * debug page — switching here re-fetches the contract registry and resets
 * wallet/socket state for the new network (see NetworkProvider).
 */
export default function NetworkSwitcher({ className = '' }: NetworkSwitcherProps) {
  const { network, setNetwork, isSwitching } = useNetwork();

  return (
    <div
      className={`flex items-center gap-2 bg-black/20 border border-hi rounded-xl px-3 py-2 ${className}`}
    >
      {network === 'mainnet' ? (
        <Globe className="w-4 h-4 text-emerald-500 shrink-0" />
      ) : (
        <FlaskConical className="w-4 h-4 text-blue-400 shrink-0" />
      )}
      <span className="text-xs font-bold uppercase tracking-widest text-muted">Network</span>
      <select
        value={network}
        disabled={isSwitching}
        onChange={(e) => setNetwork(e.target.value as NetworkType)}
        className="bg-transparent text-sm font-black focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-wait"
      >
        <option value="testnet" className="bg-slate-900 text-white">
          Testnet
        </option>
        <option value="mainnet" className="bg-slate-900 text-white">
          Mainnet
        </option>
      </select>
      {isSwitching && <Loader2 className="w-3.5 h-3.5 text-accent animate-spin shrink-0" />}
    </div>
  );
}
