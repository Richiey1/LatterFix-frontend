import { FlaskConical } from 'lucide-react';
import { useNetwork } from '../hooks/useNetwork';

/** Prominent app-wide banner shown whenever the active network isn't mainnet. */
export default function TestnetBanner() {
  const { isMainnet, network } = useNetwork();
  if (isMainnet) return null;

  return (
    <div className="w-full flex items-center justify-center gap-2 bg-blue-500/15 border-b border-blue-500/30 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-blue-300">
      <FlaskConical className="w-3.5 h-3.5" />
      {network === 'testnet' ? 'Testnet' : network} — no real funds are at risk
    </div>
  );
}
