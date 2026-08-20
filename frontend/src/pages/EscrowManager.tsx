import { useState, useEffect } from 'react';
import { ShieldAlert, Loader2, ExternalLink, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { useTaskStore, Task } from '../services/taskStore';
import { useContractTask } from '../hooks/useContractTask';
import { useWallet } from '../hooks/useWallet';
import { useHorizonAccount } from '../hooks/useHorizonAccount';
import { getExplorerUrl } from '../services/stellar';
import { queryGetEscrowStats, type SorobanEscrowStats } from '../services/sorobanTaskContract';

// Converts a task reward number (display units) to i128 stroops (7 decimals)
function toStroops(amount: number): bigint {
  return BigInt(Math.round(amount * 1e7));
}

export default function EscrowManager() {
  const { tasks, currentUser, completeTaskAndPayout, triggerDispute, resolveDispute } =
    useTaskStore();
  const { address, connect } = useWallet();
  const { balances, isLoading: balancesLoading } = useHorizonAccount(address);
  const contract = useContractTask();

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [resolutionType, setResolutionType] = useState<'Creator' | 'Contributor' | 'Split'>(
    'Split'
  );
  const [customDisputeText, setCustomDisputeText] = useState('');
  const [onChainStats, setOnChainStats] = useState<SorobanEscrowStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [txFeedback, setTxFeedback] = useState<{ hash: string; action: string } | null>(null);

  // Active escrows are InEscrow, Assigned, or Disputed tasks
  const escrowTasks = tasks.filter((t) => ['InEscrow', 'Assigned', 'Disputed'].includes(t.status));

  // Load live on-chain escrow stats from Soroban RPC
  useEffect(() => {
    queryGetEscrowStats()
      .then(setOnChainStats)
      .catch(() => setOnChainStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  // ── On-chain Release ─────────────────────────────────────────────────────
  const handleRelease = async (task: Task) => {
    if (!address) {
      await connect();
      return;
    }
    try {
      // Attempt real Soroban contract call for complete_task
      const result = await contract.completeTask(parseInt(task.id.replace('task-', '')) || 1);
      setTxFeedback({ hash: result.txHash, action: `Released ${task.reward} ${task.token}` });
      // Update local UI optimistically
      completeTaskAndPayout(task.id);
    } catch {
      // Fallback to local state if contract call fails (e.g. wallet not set up)
      completeTaskAndPayout(task.id);
    }
  };

  // ── On-chain Dispute ─────────────────────────────────────────────────────
  const handleDispute = async (task: Task) => {
    if (!customDisputeText.trim()) return;
    if (!address) {
      await connect();
      return;
    }

    try {
      const result = await contract.disputeTask(parseInt(task.id.replace('task-', '')) || 1);
      setTxFeedback({ hash: result.txHash, action: `Dispute raised for task #${task.id}` });
    } catch {
      // fall through to local state
    }
    triggerDispute(task.id, customDisputeText);
    setCustomDisputeText('');
  };

  // ── On-chain Resolve ─────────────────────────────────────────────────────
  const handleResolve = async (task: Task) => {
    if (!address) {
      await connect();
      return;
    }

    const totalStroops = toStroops(task.reward);
    let creatorRefund = 0n;
    let assigneePayout = 0n;

    if (resolutionType === 'Creator') {
      creatorRefund = totalStroops;
    } else if (resolutionType === 'Contributor') {
      assigneePayout = totalStroops;
    } else {
      const half = totalStroops / 2n;
      creatorRefund = half;
      assigneePayout = totalStroops - half;
    }

    try {
      const result = await contract.resolveDispute(
        parseInt(task.id.replace('task-', '')) || 1,
        creatorRefund,
        assigneePayout
      );
      setTxFeedback({ hash: result.txHash, action: `Dispute resolved: ${resolutionType}` });
    } catch {
      // fall through
    }
    resolveDispute(task.id, resolutionType);
    setSelectedTask(null);
  };

  return (
    <div className="space-y-8 page-fade">
      {/* Header */}
      <div className="border-b border-white/5 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Escrow &amp; Dispute Manager
          </h1>
          <p className="text-xs text-muted">
            Soroban smart contract escrows — funds locked on Stellar Testnet.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!address ? (
            <button
              onClick={connect}
              className="text-xs font-bold px-4 py-2 bg-accent text-bg rounded-xl hover:scale-105 transition-transform flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" /> Connect Wallet
            </button>
          ) : (
            <span className="text-xs font-mono bg-green-500/10 border border-green-500/20 text-green-400 px-3 py-1.5 rounded-xl">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          )}
          <span className="text-xs font-mono bg-white/5 border border-white/5 px-3 py-1.5 rounded-lg text-muted">
            TVL: {escrowTasks.reduce((sum, t) => sum + t.reward, 0).toLocaleString()} tokens
          </span>
        </div>
      </div>

      {/* TX Confirmation Banner */}
      {txFeedback && (
        <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-center gap-3 text-xs">
          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
          <div className="flex-1">
            <p className="text-green-400 font-bold">{txFeedback.action}</p>
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

      {/* Contract Error Banner */}
      {contract.error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-xs">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-red-400">{contract.error}</p>
        </div>
      )}

      {/* On-chain Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Locked (On-chain)',
            value: onChainStats ? `${(Number(onChainStats.totalLocked) / 1e7).toFixed(4)}` : '—',
            sub: 'Stroops → tokens',
          },
          {
            label: 'Active Escrows',
            value: onChainStats ? String(onChainStats.activeEscrows) : '—',
            sub: 'Soroban contract',
          },
          {
            label: 'Completed Escrows',
            value: onChainStats ? String(onChainStats.completedEscrows) : '—',
            sub: 'Fully settled',
          },
          {
            label: 'Your XLM Balance',
            value: balancesLoading ? '...' : `${parseFloat(balances.XLM).toFixed(4)} XLM`,
            sub: address ? 'Horizon live' : 'Connect wallet',
          },
        ].map((stat) => (
          <div key={stat.label} className="card glass noise p-4 space-y-1">
            {statsLoading && stat.value === '—' ? (
              <Loader2 className="w-4 h-4 text-accent animate-spin" />
            ) : (
              <p className="text-lg font-black text-white">{stat.value}</p>
            )}
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
              {stat.label}
            </p>
            <p className="text-[9px] text-white/30">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Escrow List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card glass noise p-6 space-y-4">
            <h3 className="text-lg font-bold text-white border-b border-white/5 pb-3">
              Active Smart Contract Escrows
              <span className="ml-2 text-[10px] font-mono text-muted">
                TaskManagerContract.sol → Soroban
              </span>
            </h3>

            <div className="divide-y divide-white/5">
              {escrowTasks.length > 0 ? (
                escrowTasks.map((task) => (
                  <div
                    key={task.id}
                    className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            task.status === 'Disputed'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : task.status === 'Assigned'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                          }`}
                        >
                          {task.status === 'InEscrow' ? 'Funded' : task.status}
                        </span>
                        <span className="text-xs font-mono text-muted">#{task.id}</span>
                      </div>
                      <h4
                        className="text-sm font-bold text-white hover:underline cursor-pointer"
                        onClick={() => setSelectedTask(task)}
                      >
                        {task.title}
                      </h4>
                      <p className="text-[11px] text-muted font-mono truncate max-w-sm mt-1">
                        Creator: {task.creator.slice(0, 10)}... | Assignee:{' '}
                        {task.assignee ? task.assignee.slice(0, 10) : 'None'}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
                      <div className="text-right">
                        <p className="text-sm font-black text-white">
                          {task.reward} {task.token}
                        </p>
                        <p className="text-[10px] text-muted">Locked in Escrow</p>
                      </div>
                      <button
                        onClick={() => setSelectedTask(task)}
                        className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition"
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-muted text-sm">
                  No active escrows currently locked in the smart contract.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Inspect / Actions Panel */}
        <div className="space-y-6">
          <div className="card glass noise p-6 space-y-6">
            <h3 className="text-lg font-bold text-white border-b border-white/5 pb-3">
              Arbitration Inspector
            </h3>

            {selectedTask ? (
              <div className="space-y-5">
                <div className="bg-black/20 p-4 rounded-xl border border-white/5 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted">Contract Method:</span>
                    <span className="font-mono text-accent text-[10px]">
                      complete_task / dispute_task
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Escrow ID:</span>
                    <span className="font-mono text-white">#{selectedTask.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Locked Reward:</span>
                    <span className="font-bold text-accent">
                      {selectedTask.reward} {selectedTask.token}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">In Stroops:</span>
                    <span className="font-mono text-white/60 text-[10px]">
                      {toStroops(selectedTask.reward).toString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Status:</span>
                    <span className="font-bold text-white">{selectedTask.status}</span>
                  </div>
                  {selectedTask.disputeReason && (
                    <div className="border-t border-white/5 pt-2 mt-2">
                      <span className="text-red-400 font-bold block mb-1">Dispute Reason:</span>
                      <p className="text-white/80 italic">"{selectedTask.disputeReason}"</p>
                    </div>
                  )}
                </div>

                {/* Contributor Action */}
                {currentUser.role === 'Contributor' &&
                  selectedTask.assignee === currentUser.address &&
                  selectedTask.status === 'Assigned' && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted">
                        Raise a dispute if terms changed unfairly. Calls{' '}
                        <code className="text-accent">dispute_task</code> on-chain.
                      </p>
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          placeholder="Reason for dispute..."
                          value={customDisputeText}
                          onChange={(e) => setCustomDisputeText(e.target.value)}
                          className="bg-black/20 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none"
                        />
                        <button
                          onClick={() => handleDispute(selectedTask)}
                          disabled={contract.isLoading}
                          className="w-full py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/25 rounded-xl font-bold transition text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {contract.isLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : null}
                          Raise Dispute {address ? '(On-chain)' : '— Connect Wallet'}
                        </button>
                      </div>
                    </div>
                  )}

                {/* Creator Action */}
                {currentUser.role === 'Creator' &&
                  selectedTask.creator === currentUser.address &&
                  selectedTask.status === 'Assigned' && (
                    <div className="space-y-4">
                      <p className="text-xs text-muted">
                        Release funds via <code className="text-accent">complete_task</code> or open
                        a dispute.
                      </p>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleRelease(selectedTask)}
                          disabled={contract.isLoading}
                          className="w-full py-2.5 bg-accent text-bg font-extrabold rounded-xl hover:scale-102 transition-transform text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {contract.isLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : null}
                          Release Payout {address ? '(On-chain)' : '— Connect Wallet'}
                        </button>
                        <input
                          type="text"
                          placeholder="Reason for dispute..."
                          value={customDisputeText}
                          onChange={(e) => setCustomDisputeText(e.target.value)}
                          className="bg-black/20 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none"
                        />
                        <button
                          onClick={() => handleDispute(selectedTask)}
                          disabled={contract.isLoading}
                          className="w-full py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/25 rounded-xl font-bold transition text-xs disabled:opacity-50"
                        >
                          File Dispute
                        </button>
                      </div>
                    </div>
                  )}

                {/* Admin Action (Dispute Arbitration) */}
                {currentUser.role === 'Admin' && selectedTask.status === 'Disputed' && (
                  <div className="space-y-4 bg-purple-500/5 border border-purple-500/10 p-4 rounded-xl">
                    <h4 className="text-xs font-bold text-purple-400 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> Resolve via{' '}
                      <code className="ml-1 text-accent">resolve_dispute</code>
                    </h4>
                    <p className="text-[11px] text-muted">
                      Splits {selectedTask.reward} {selectedTask.token} (
                      {toStroops(selectedTask.reward).toString()} stroops) between parties.
                    </p>
                    <div className="flex flex-col gap-2">
                      <select
                        value={resolutionType}
                        onChange={(e) =>
                          setResolutionType(e.target.value as 'Creator' | 'Contributor' | 'Split')
                        }
                        className="bg-black/25 border border-white/10 rounded-lg p-2 text-xs text-white"
                      >
                        <option value="Contributor">Award 100% to Contributor (Payout)</option>
                        <option value="Creator">Award 100% to Creator (Refund)</option>
                        <option value="Split">Split 50% / 50% (Creator &amp; Contributor)</option>
                      </select>
                      <button
                        onClick={() => handleResolve(selectedTask)}
                        disabled={contract.isLoading}
                        className="w-full py-2.5 bg-purple-500 text-white font-extrabold rounded-xl hover:scale-102 transition-transform text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {contract.isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : null}
                        Execute Resolution {address ? '(On-chain)' : '— Connect Wallet'}
                      </button>
                    </div>
                  </div>
                )}

                {selectedTask.status === 'Completed' && (
                  <div className="text-center text-xs text-green-400 font-bold bg-green-500/10 p-4 rounded-xl border border-green-500/20">
                    This escrow has been completed and fully settled on Stellar.
                  </div>
                )}

                {selectedTask.status === 'InEscrow' && currentUser.role !== 'Creator' && (
                  <div className="text-center text-xs text-muted bg-white/5 p-4 rounded-xl">
                    Waiting for Creator to assign an applicant to start the contract.
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10 text-muted text-xs">
                Select an active escrow to inspect release options and arbitration controls.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
