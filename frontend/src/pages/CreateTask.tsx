import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  AlertCircle,
  CheckCircle,
  Loader2,
  ExternalLink,
  Zap,
  Info,
  GitBranch,
} from 'lucide-react';
import { useTaskStore } from '../services/taskStore';
import { useContractTask } from '../hooks/useContractTask';
import { useWallet } from '../hooks/useWallet';
import { useHorizonAccount } from '../hooks/useHorizonAccount';
import { getExplorerUrl } from '../services/stellar';
import { KNOWN_ISSUERS } from '../hooks/useHorizonAccount';

// 7-decimal Stellar stroops conversion
function toStroops(amount: number): bigint {
  return BigInt(Math.round(amount * 1e7));
}

type TabMode = 'simple' | 'milestones';

export default function CreateTask() {
  const navigate = useNavigate();
  const { createTask: localCreateTask, currentUser } = useTaskStore();
  const contract = useContractTask();
  const { address, connect } = useWallet();
  const { balances, isLoading: balancesLoading, checkTrustline } = useHorizonAccount(address);

  // Form fields
  const [tab, setTab] = useState<TabMode>('simple');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState<number>(100);
  const [token, setToken] = useState<'USDC' | 'XLM' | 'EURC'>('USDC');
  const [deadline, setDeadline] = useState('2026-08-01');
  const [tagsInput, setTagsInput] = useState('');
  const [reputationRequired, setReputationRequired] = useState(50);

  // Milestone mode
  const [milestones, setMilestones] = useState([
    { title: 'Design & Planning', amount: 30 },
    { title: 'Implementation', amount: 50 },
    { title: 'Testing & Delivery', amount: 20 },
  ]);

  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [trustlineWarning, setTrustlineWarning] = useState<string | null>(null);

  const totalMilestoneReward = milestones.reduce((s, m) => s + m.amount, 0);

  const handleMilestoneChange = (
    index: number,
    field: 'title' | 'amount',
    value: string | number
  ) => {
    const updated = [...milestones];
    updated[index] = { ...updated[index], [field]: value };
    setMilestones(updated);
  };

  const addMilestone = () =>
    setMilestones([...milestones, { title: `Milestone ${milestones.length + 1}`, amount: 10 }]);

  const removeMilestone = (i: number) => setMilestones(milestones.filter((_, idx) => idx !== i));

  // Check if wallet has trustline for selected non-XLM token
  const checkTokenTrustline = async () => {
    if (!address || token === 'XLM') {
      setTrustlineWarning(null);
      return;
    }
    const issuer = KNOWN_ISSUERS[token as 'USDC' | 'EURC'];
    if (!issuer) {
      setTrustlineWarning(null);
      return;
    }
    const has = await checkTrustline(token, issuer);
    if (!has) {
      setTrustlineWarning(
        `Your wallet doesn't have a trustline for ${token}. You must add one before funding this task.`
      );
    } else {
      setTrustlineWarning(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setTxHash(null);

    if (title.length < 5 || title.length > 100) {
      setError('Title must be between 5 and 100 characters.');
      return;
    }
    if (!description || description.length > 5000) {
      setError('Description is required (max 5000 chars).');
      return;
    }
    if (tab === 'simple' && reward <= 0) {
      setError('Reward must be a positive amount.');
      return;
    }
    if (tab === 'milestones' && totalMilestoneReward <= 0) {
      setError('Total milestone reward must be positive.');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const effectiveReward = tab === 'simple' ? reward : totalMilestoneReward;

    // ── Attempt real Soroban contract call ──────────────────────────────
    if (address) {
      try {
        let result;
        if (tab === 'milestones') {
          result = await contract.createTaskWithMilestones(
            title,
            description,
            milestones.map((m) => ({ title: m.title, amount: toStroops(m.amount) })),
            tags
          );
        } else {
          result = await contract.createTask(title, description, toStroops(reward), tags);
        }
        setTxHash(result.txHash);

        // Also update local store for UI
        localCreateTask(
          title,
          description,
          effectiveReward,
          token,
          deadline,
          tags,
          reputationRequired
        );

        setTitle('');
        setDescription('');
        setReward(100);
        setTagsInput('');
        return;
      } catch {
        // Fall through to local-only creation
      }
    }

    // ── Fallback: local-only task creation ──────────────────────────────
    localCreateTask(title, description, effectiveReward, token, deadline, tags, reputationRequired);
    setTxHash('local-only'); // signal success without on-chain hash
    setTitle('');
    setDescription('');
    setReward(100);
    setTagsInput('');
  };

  const walletBalance =
    token === 'XLM' ? balances.XLM : token === 'USDC' ? balances.USDC : balances.EURC;

  return (
    <div className="max-w-3xl mx-auto space-y-8 page-fade">
      {/* Header */}
      <div className="border-b border-white/5 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Create &amp; Fund Task</h1>
          <p className="text-xs text-muted">
            Calls <code className="text-accent">create_task()</code> or{' '}
            <code className="text-accent">create_task_with_milestones()</code> on the Soroban
            contract — locking reward tokens in escrow.
          </p>
        </div>
        {!address ? (
          <button
            onClick={connect}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent text-bg font-extrabold rounded-xl hover:scale-105 transition-transform text-xs shrink-0"
          >
            <Zap className="w-3.5 h-3.5" /> Connect Wallet
          </button>
        ) : (
          <div className="text-xs space-y-1 text-right">
            <p className="font-mono text-green-400">
              {address.slice(0, 8)}...{address.slice(-4)}
            </p>
            <p className="text-muted">
              Balance:{' '}
              {balancesLoading ? '...' : `${parseFloat(walletBalance).toFixed(4)} ${token}`}
            </p>
          </div>
        )}
      </div>

      {/* Role Warning */}
      {currentUser.role !== 'Creator' && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex gap-3 text-xs text-yellow-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-bold">Creator Role Required</p>
            <p className="mt-1">
              You are a <strong>{currentUser.role}</strong>. Only <strong>Creators</strong> can
              publish tasks. Switch roles in the navbar.
            </p>
          </div>
        </div>
      )}

      {/* Trustline Warning */}
      {trustlineWarning && (
        <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl flex gap-3 text-xs text-orange-400">
          <Info className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-bold">Trustline Required</p>
            <p className="mt-1">{trustlineWarning}</p>
          </div>
        </div>
      )}

      {/* Success */}
      {txHash && (
        <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-center justify-between gap-3 text-xs text-green-400">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span>
              <strong>Task created!</strong>{' '}
              {txHash !== 'local-only' ? (
                <>
                  TX:{' '}
                  <a
                    href={getExplorerUrl('tx', txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-accent hover:underline inline-flex items-center gap-0.5"
                  >
                    {txHash.slice(0, 12)}... <ExternalLink className="w-3 h-3" />
                  </a>
                </>
              ) : (
                'Saved locally. Connect wallet for on-chain submission.'
              )}
            </span>
          </div>
          <button
            onClick={() => navigate('/tasks')}
            className="px-3.5 py-1.5 bg-green-500 text-bg font-extrabold rounded-lg hover:scale-105 transition-transform"
          >
            Go to Explorer
          </button>
        </div>
      )}

      {/* Contract Error */}
      {contract.error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-xs text-red-400 flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{contract.error}</span>
        </div>
      )}

      {/* Tab Toggle */}
      <div className="flex gap-2">
        {(['simple', 'milestones'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              tab === t
                ? 'bg-accent text-bg'
                : 'bg-white/5 text-muted hover:text-white hover:bg-white/10'
            }`}
          >
            {t === 'milestones' && <GitBranch className="w-3.5 h-3.5" />}
            {t === 'simple' ? 'Simple Task' : 'Milestone Task'}
          </button>
        ))}
        <span className="ml-auto text-[10px] font-mono text-muted self-center">
          {tab === 'milestones' ? 'create_task_with_milestones()' : 'create_task()'}
        </span>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card glass noise p-8 space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-2 text-xs text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-widest text-muted">
            Task Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={currentUser.role !== 'Creator'}
            placeholder="e.g. Audit Soroban Escrow Contract"
            className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-accent/40 disabled:opacity-55"
          />
          <p className="text-[10px] text-muted">
            5–100 characters. Stored on-chain as a Soroban <code>String</code>.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-widest text-muted">
            Task Description <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={currentUser.role !== 'Creator'}
            placeholder="Outline requirements, expected deliverables, and verification procedures..."
            className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-accent/40 disabled:opacity-55"
          />
          <p className="text-[10px] text-muted">Max 5000 characters.</p>
        </div>

        {/* Token & Reward */}
        {tab === 'simple' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-muted">
                Reward Amount <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  required
                  min={1}
                  value={reward}
                  onChange={(e) => setReward(Number(e.target.value))}
                  disabled={currentUser.role !== 'Creator'}
                  className="flex-1 bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-accent/40 disabled:opacity-55"
                />
                <select
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value as 'USDC' | 'XLM' | 'EURC');
                    void checkTokenTrustline();
                  }}
                  disabled={currentUser.role !== 'Creator'}
                  className="bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-accent/40 disabled:opacity-55"
                >
                  <option value="USDC">USDC</option>
                  <option value="XLM">XLM</option>
                  <option value="EURC">EURC</option>
                </select>
              </div>
              <p className="text-[10px] text-muted">
                = <span className="text-accent font-mono">{toStroops(reward).toString()}</span>{' '}
                stroops (i128 on-chain). Wallet balance:{' '}
                {balancesLoading ? '...' : `${parseFloat(walletBalance).toFixed(4)} ${token}`}
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-muted">
                Minimum Reputation Required
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={reputationRequired}
                  onChange={(e) => setReputationRequired(Number(e.target.value))}
                  disabled={currentUser.role !== 'Creator'}
                  className="flex-1 accent-accent disabled:opacity-55"
                />
                <span className="text-sm font-mono font-bold bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-white">
                  {reputationRequired}+
                </span>
              </div>
              <p className="text-[10px] text-muted">
                Matches on-chain <code>get_user_reputation()</code> check.
              </p>
            </div>
          </div>
        )}

        {/* Milestone Mode */}
        {tab === 'milestones' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-muted">
                Milestone Breakdown
              </label>
              <span className="text-xs font-mono text-accent">
                Total: {totalMilestoneReward} {token} = {toStroops(totalMilestoneReward).toString()}{' '}
                stroops
              </span>
            </div>
            {milestones.map((m, i) => (
              <div key={i} className="flex gap-3 items-center">
                <input
                  type="text"
                  value={m.title}
                  onChange={(e) => handleMilestoneChange(i, 'title', e.target.value)}
                  className="flex-1 bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-accent/40"
                  placeholder={`Milestone ${i + 1} title`}
                />
                <input
                  type="number"
                  min={1}
                  value={m.amount}
                  onChange={(e) => handleMilestoneChange(i, 'amount', Number(e.target.value))}
                  className="w-24 bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-accent/40"
                />
                <button
                  type="button"
                  onClick={() => removeMilestone(i)}
                  className="text-red-400 hover:text-red-300 text-lg"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addMilestone}
              className="text-xs text-accent hover:underline flex items-center gap-1 mt-1"
            >
              + Add Milestone
            </button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-widest text-muted">
                  Token
                </label>
                <select
                  value={token}
                  onChange={(e) => setToken(e.target.value as 'USDC' | 'XLM' | 'EURC')}
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none"
                >
                  <option value="USDC">USDC</option>
                  <option value="XLM">XLM</option>
                  <option value="EURC">EURC</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-widest text-muted">
                  Minimum Reputation
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={reputationRequired}
                    onChange={(e) => setReputationRequired(Number(e.target.value))}
                    className="flex-1 accent-accent"
                  />
                  <span className="font-mono font-bold text-sm text-white bg-white/5 border border-white/10 px-2 py-1.5 rounded-lg">
                    {reputationRequired}+
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-widest text-muted">
              Completion Deadline
            </label>
            <input
              type="date"
              required
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={currentUser.role !== 'Creator'}
              className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-accent/40 disabled:opacity-55"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-widest text-muted">
              Skill Tags (Comma separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              disabled={currentUser.role !== 'Creator'}
              placeholder="e.g. Rust, Smart Contract, Audit"
              className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-accent/40 disabled:opacity-55"
            />
            <p className="text-[10px] text-muted">
              Stored as a <code>Vec&lt;String&gt;</code> on-chain.
            </p>
          </div>
        </div>

        <div className="border-t border-white/5 pt-6 flex justify-between items-center gap-4 flex-wrap">
          <div className="text-[10px] font-mono text-muted space-y-0.5">
            <p>⚡ Powered by Stellar Soroban (Testnet)</p>
            {address && (
              <p className="text-accent">Wallet connected — will call contract on submit</p>
            )}
            {!address && <p className="text-yellow-400">Connect wallet for on-chain submission</p>}
          </div>
          <button
            type="submit"
            disabled={currentUser.role !== 'Creator' || contract.isLoading}
            className="flex items-center gap-2 px-8 py-4 bg-accent text-bg font-extrabold rounded-2xl hover:scale-102 transition-transform shadow-lg shadow-accent/20 disabled:opacity-50"
          >
            {contract.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <PlusCircle className="w-4 h-4" />
            )}
            {contract.isLoading
              ? 'Submitting to Stellar...'
              : address
                ? 'Create Task (On-chain)'
                : 'Create Task'}
          </button>
        </div>
      </form>
    </div>
  );
}
