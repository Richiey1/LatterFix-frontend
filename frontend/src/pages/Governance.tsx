import React, { useState, useEffect } from 'react';
import {
  Shield,
  AlertTriangle,
  Play,
  Pause,
  Save,
  Database,
  Loader2,
  ExternalLink,
  Users,
  CheckCircle2,
  Vote,
  Zap,
} from 'lucide-react';
import { useTaskStore } from '../services/taskStore';
import { useContractTask } from '../hooks/useContractTask';
import { useWallet } from '../hooks/useWallet';
import { getExplorerUrl } from '../services/stellar';
import {
  queryGetActiveProposals,
  queryGetStatistics,
  type SorobanProposal,
  type SorobanContractStatistics,
} from '../services/sorobanTaskContract';

export default function Governance() {
  const { governance, setPlatformFee, togglePause, currentUser, resetAll } = useTaskStore();
  const { address, connect } = useWallet();
  const contract = useContractTask();

  const [feeBps, setFeeBps] = useState(governance.platformFeeBps);
  const [adminAddress, setAdminAddress] = useState(governance.adminAddress);
  const [tokens, setTokens] = useState<('USDC' | 'XLM' | 'EURC')[]>(governance.whitelistedTokens);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [txFeedback, setTxFeedback] = useState<{ hash: string; label: string } | null>(null);

  // On-chain governance data
  const [proposals, setProposals] = useState<SorobanProposal[]>([]);
  const [contractStats, setContractStats] = useState<SorobanContractStatistics | null>(null);
  const [proposalsLoading, setProposalsLoading] = useState(true);

  // New proposal form
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [grantRoleAddress, setGrantRoleAddress] = useState('');
  const [grantRoleType, setGrantRoleType] = useState<'Admin' | 'Moderator' | 'Verifier'>(
    'Moderator'
  );

  // Load active proposals and contract stats from Soroban RPC
  useEffect(() => {
    Promise.all([
      queryGetActiveProposals().catch(() => []),
      queryGetStatistics().catch(() => null),
    ]).then(([fetchedProposals, stats]) => {
      setProposals(fetchedProposals ?? []);
      setContractStats(stats);
      setProposalsLoading(false);
    });
  }, []);

  // ── Local save (updates UI state — would be replace with setParameter call) ──
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role !== 'Admin') {
      alert('Access Denied: Only platform administrators can save changes.');
      return;
    }
    setPlatformFee(feeBps);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // ── On-chain Emergency Pause via pause_all ───────────────────────────────
  const handleTogglePause = async () => {
    if (currentUser.role !== 'Admin') {
      alert('Access Denied: Only platform administrators can toggle paused state.');
      return;
    }

    if (!address) {
      await connect();
      return;
    }

    try {
      let result;
      if (governance.paused) {
        result = await contract.unpauseAll();
      } else {
        result = await contract.pauseAll();
      }
      setTxFeedback({
        hash: result.txHash,
        label: governance.paused
          ? 'Contract resumed on-chain'
          : 'Contract emergency paused on-chain',
      });
    } catch {
      // fall through to local state toggle
    }
    togglePause();
  };

  // ── On-chain Create Proposal ─────────────────────────────────────────────
  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) return;
    if (!address) {
      await connect();
      return;
    }

    try {
      const result = await contract.createProposal(newTitle, newDescription);
      setTxFeedback({ hash: result.txHash, label: `Proposal "${newTitle}" created on-chain` });
      setNewTitle('');
      setNewDescription('');
      // Re-fetch proposals
      const updated = await queryGetActiveProposals().catch(() => []);
      setProposals(updated ?? []);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create proposal');
    }
  };

  // ── On-chain Vote ────────────────────────────────────────────────────────
  const handleVote = async (proposalId: number, voteType: 'For' | 'Against' | 'Abstain') => {
    if (!address) {
      await connect();
      return;
    }
    try {
      const result = await contract.castVote(proposalId, voteType);
      setTxFeedback({ hash: result.txHash, label: `Voted ${voteType} on proposal #${proposalId}` });
      const updated = await queryGetActiveProposals().catch(() => []);
      setProposals(updated ?? []);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Vote failed');
    }
  };

  // ── On-chain Grant Role ──────────────────────────────────────────────────
  const handleGrantRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantRoleAddress.trim()) return;
    if (!address) {
      await connect();
      return;
    }
    try {
      const result = await contract.grantRole(grantRoleAddress, grantRoleType);
      setTxFeedback({ hash: result.txHash, label: `${grantRoleType} role granted on-chain` });
      setGrantRoleAddress('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Role grant failed');
    }
  };

  const handleReset = () => {
    if (confirm('Reset all mock tasks and payment history to default state?')) {
      resetAll();
      setFeeBps(250);
      setAdminAddress('G-CREATOR-Admin-111');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 page-fade">
      {/* Header */}
      <div className="border-b border-white/5 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Platform Governance</h1>
          <p className="text-xs text-muted">
            On-chain Soroban governance — proposals, voting, and admin operations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!address ? (
            <button
              onClick={connect}
              className="text-xs font-bold px-3 py-1.5 bg-accent text-bg rounded-xl hover:scale-105 transition-transform flex items-center gap-1"
            >
              <Zap className="w-3 h-3" /> Connect
            </button>
          ) : (
            <span className="text-xs font-mono bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-1 rounded-lg">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          )}
          <span className="text-xs font-mono bg-purple-500/10 border border-purple-500/20 text-purple-400 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Admin View
          </span>
        </div>
      </div>

      {/* TX Confirmation */}
      {txFeedback && (
        <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-center gap-3 text-xs">
          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
          <div className="flex-1">
            <p className="text-green-400 font-bold">{txFeedback.label}</p>
            <p className="text-muted font-mono">{txFeedback.hash.slice(0, 32)}...</p>
          </div>
          <a
            href={getExplorerUrl('tx', txFeedback.hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent flex items-center gap-1 hover:underline"
          >
            View <ExternalLink className="w-3 h-3" />
          </a>
          <button onClick={() => setTxFeedback(null)} className="text-muted hover:text-white">
            ✕
          </button>
        </div>
      )}

      {currentUser.role !== 'Admin' && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex gap-3 text-xs text-yellow-400">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-bold">Administrator Privileges Required</p>
            <p className="mt-1">
              You are a <strong>{currentUser.role}</strong>. On-chain admin operations (pause, grant
              role, execute proposals) require the Admin role.
            </p>
          </div>
        </div>
      )}

      {/* On-chain Contract Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Tasks Created',
            value: contractStats ? String(contractStats.totalTasksCreated) : '—',
          },
          {
            label: 'Tasks Completed',
            value: contractStats ? String(contractStats.totalTasksCompleted) : '—',
          },
          {
            label: 'Total Value Paid',
            value: contractStats
              ? `${(Number(contractStats.totalValuePaid) / 1e7).toFixed(2)}`
              : '—',
          },
          {
            label: 'Platform Fees',
            value: contractStats
              ? `${(Number(contractStats.totalPlatformFees) / 1e7).toFixed(2)}`
              : '—',
          },
        ].map((stat) => (
          <div key={stat.label} className="card glass noise p-4 space-y-1">
            {proposalsLoading && stat.value === '—' ? (
              <Loader2 className="w-4 h-4 text-accent animate-spin" />
            ) : (
              <p className="text-xl font-black text-white">{stat.value}</p>
            )}
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Contract initialization state card */}
      <div className="card glass noise p-6 flex flex-col sm:flex-row items-center justify-between gap-6 border-l-4 border-l-accent">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-lg font-bold text-white flex items-center gap-1.5 justify-center sm:justify-start">
            <Database className="w-4 h-4 text-accent" />
            Contract:
            <span className="font-mono text-xs bg-white/5 px-2 py-0.5 rounded text-muted">
              TaskManagerContract (Soroban)
            </span>
          </h3>
          <p className="text-xs text-muted">
            Platform Fee: {governance.platformFeeBps / 100}% | Emergency Paused:{' '}
            {governance.paused ? 'YES' : 'NO'} | Network: Testnet
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleTogglePause}
            disabled={currentUser.role !== 'Admin' || contract.isLoading}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition ${
              governance.paused
                ? 'bg-green-500 text-bg hover:bg-green-600'
                : 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20'
            } disabled:opacity-50`}
          >
            {contract.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : governance.paused ? (
              <>
                <Play className="w-4 h-4" /> Unpause (On-chain)
              </>
            ) : (
              <>
                <Pause className="w-4 h-4" /> Emergency Pause (On-chain)
              </>
            )}
          </button>
        </div>
      </div>

      {/* On-chain Active Proposals */}
      <div className="card glass noise p-6 space-y-4">
        <h3 className="text-lg font-bold text-white border-b border-white/5 pb-3 flex items-center gap-2">
          <Vote className="w-4 h-4 text-accent" /> Active On-chain Proposals
          {proposalsLoading && <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />}
        </h3>

        {proposals.length > 0 ? (
          <div className="divide-y divide-white/5">
            {proposals.map((p) => (
              <div key={p.id} className="py-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono text-muted mr-2">#{p.id}</span>
                    <span className="text-sm font-bold text-white">{p.title}</span>
                    <p className="text-xs text-muted mt-1">{p.description}</p>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-accent/30 text-accent shrink-0">
                    {p.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-green-400">✓ For: {p.votesFor}</span>
                  <span className="text-red-400">✗ Against: {p.votesAgainst}</span>
                  <span className="text-muted">Abstain: {p.votesAbstain}</span>
                </div>
                <div className="flex gap-2">
                  {(['For', 'Against', 'Abstain'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => handleVote(p.id, v)}
                      disabled={!address || contract.isLoading}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-40 ${
                        v === 'For'
                          ? 'bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20'
                          : v === 'Against'
                            ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20'
                            : 'bg-white/5 border border-white/10 text-muted hover:bg-white/10'
                      }`}
                    >
                      {contract.isLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin inline" />
                      ) : null}{' '}
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted text-xs text-center py-4">
            {proposalsLoading
              ? 'Loading from Soroban RPC...'
              : 'No active proposals on-chain. Create one below.'}
          </p>
        )}
      </div>

      {/* Create Proposal Form */}
      <form onSubmit={handleCreateProposal} className="card glass noise p-6 space-y-4">
        <h3 className="text-lg font-bold text-white border-b border-white/5 pb-3 flex items-center gap-2">
          <Vote className="w-4 h-4 text-purple-400" /> Create On-chain Proposal
          <span className="text-[10px] font-mono text-muted ml-1">create_proposal()</span>
        </h3>
        <div className="grid grid-cols-1 gap-4">
          <input
            type="text"
            placeholder="Proposal title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-accent/40"
          />
          <textarea
            placeholder="Describe the governance change..."
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            rows={3}
            className="bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-accent/40 resize-none"
          />
        </div>
        <button
          type="submit"
          disabled={contract.isLoading || !newTitle.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-purple-500 text-white font-extrabold rounded-xl hover:scale-102 transition-transform shadow-lg shadow-purple-500/20 disabled:opacity-50 text-xs"
        >
          {contract.isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Vote className="w-4 h-4" />
          )}
          Submit Proposal {address ? '(On-chain)' : '— Connect Wallet First'}
        </button>
      </form>

      {/* Grant Role Form */}
      {currentUser.role === 'Admin' && (
        <form onSubmit={handleGrantRole} className="card glass noise p-6 space-y-4">
          <h3 className="text-lg font-bold text-white border-b border-white/5 pb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" /> Grant On-chain Role
            <span className="text-[10px] font-mono text-muted ml-1">grant_role()</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Stellar address (G...)"
              value={grantRoleAddress}
              onChange={(e) => setGrantRoleAddress(e.target.value)}
              className="bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white font-mono focus:outline-none focus:border-accent/40"
            />
            <select
              value={grantRoleType}
              onChange={(e) =>
                setGrantRoleType(e.target.value as 'Admin' | 'Moderator' | 'Verifier')
              }
              className="bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none"
            >
              <option value="Moderator">Moderator</option>
              <option value="Verifier">Verifier</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={contract.isLoading || !grantRoleAddress.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-bg font-extrabold rounded-xl hover:scale-102 transition-transform text-xs disabled:opacity-50"
          >
            {contract.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Shield className="w-4 h-4" />
            )}
            Grant {grantRoleType} Role (On-chain)
          </button>
        </form>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="card glass noise p-8 space-y-6">
        <h3 className="text-lg font-bold text-white border-b border-white/5 pb-3">
          Smart Contract Parameters
        </h3>

        {saveSuccess && (
          <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-center gap-2 text-xs text-green-400">
            <Shield className="w-4 h-4" />
            <span>
              Settings saved! To persist on-chain, call <code>set_platform_fee()</code> via admin
              wallet.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-widest text-muted">
              Platform Fee (Basis Points)
            </label>
            <input
              type="number"
              value={feeBps}
              onChange={(e) => setFeeBps(Number(e.target.value))}
              disabled={currentUser.role !== 'Admin'}
              className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-accent/40 disabled:opacity-50"
            />
            <p className="text-[10px] text-muted">
              100 bps = 1%. Current: {(feeBps / 100).toFixed(2)}%. Max: 1000 bps (10%). Validated by
              smart contract.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-widest text-muted">
              Contract Admin Address
            </label>
            <input
              type="text"
              value={adminAddress}
              onChange={(e) => setAdminAddress(e.target.value)}
              disabled={currentUser.role !== 'Admin'}
              className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-white font-mono focus:outline-none focus:border-accent/40 disabled:opacity-50"
            />
            <p className="text-[10px] text-muted">
              The public key with <code>require_auth()</code> authority for emergency halts.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-widest text-muted">
            Whitelisted Stellar Tokens
          </label>
          <div className="flex gap-4">
            {['USDC', 'XLM', 'EURC'].map((token) => {
              const isChecked = tokens.includes(token as 'USDC' | 'XLM' | 'EURC');
              return (
                <label
                  key={token}
                  className="flex items-center gap-2 text-sm text-white cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={currentUser.role !== 'Admin'}
                    onChange={() => {
                      if (isChecked) {
                        setTokens(tokens.filter((t) => t !== token));
                      } else {
                        setTokens([...tokens, token as 'USDC' | 'XLM' | 'EURC']);
                      }
                    }}
                    className="rounded border-white/10 bg-black/20 accent-accent"
                  />
                  {token}
                </label>
              );
            })}
          </div>
          <p className="text-[10px] text-muted">
            Whitelisted assets accepted as task rewards by the Soroban token client.
          </p>
        </div>

        <div className="border-t border-white/5 pt-6 flex justify-between items-center">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/25 rounded-xl text-xs font-bold transition"
          >
            Reset Demo Database
          </button>
          <button
            type="submit"
            disabled={currentUser.role !== 'Admin'}
            className="flex items-center gap-2 px-6 py-3 bg-accent text-bg font-extrabold rounded-xl hover:scale-102 transition-transform shadow-lg shadow-accent/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> Save Parameters
          </button>
        </div>
      </form>
    </div>
  );
}
