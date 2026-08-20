import { Shield, AlertTriangle } from 'lucide-react';
import { useTaskStore } from '../services/taskStore';
import { useWallet } from '../hooks/useWallet';
import NetworkSwitcher from '../components/NetworkSwitcher';
import ContractUpgradeTab from '../components/ContractUpgradeTab';

export default function AdminPanel() {
  const { currentUser } = useTaskStore();
  const { address, connect } = useWallet();
  const isAdmin = currentUser.role === 'Admin';

  return (
    <div className="max-w-5xl mx-auto space-y-8 page-fade">
      {/* Header */}
      <div className="border-b border-white/5 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <Shield className="w-7 h-7 text-accent" /> Admin Panel
          </h1>
          <p className="text-xs text-muted mt-1">
            Network configuration and Soroban contract upgrade management.
          </p>
        </div>
        <NetworkSwitcher />
      </div>

      {!isAdmin ? (
        <div className="flex items-start gap-3 p-5 bg-yellow-500/5 border border-yellow-500/30 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-400">
            <p className="font-bold">Administrator Privileges Required</p>
            <p className="mt-1 text-yellow-400/80">
              You are a <strong>{currentUser.role}</strong>. Switch to the Admin role to manage
              network settings and contract upgrades.
            </p>
          </div>
        </div>
      ) : (
        <>
          {!address && (
            <div className="flex items-center justify-between gap-4 p-4 bg-black/20 border border-hi rounded-2xl">
              <p className="text-sm text-muted">
                Connect your admin wallet to initiate contract upgrades.
              </p>
              <button
                onClick={() => void connect()}
                className="shrink-0 px-4 py-2 bg-accent/15 text-accent border border-accent/30 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-accent hover:text-black transition-all"
              >
                Connect Wallet
              </button>
            </div>
          )}

          <ContractUpgradeTab adminAddress={address ?? ''} />
        </>
      )}
    </div>
  );
}
