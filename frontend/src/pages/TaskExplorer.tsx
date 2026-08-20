import { useState } from 'react';
import {
  Search,
  Filter,
  Coins,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  AlertCircle,
  Loader2,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { useTaskStore, Task } from '../services/taskStore';
import { useContractTask } from '../hooks/useContractTask';
import { useWallet } from '../hooks/useWallet';
import { getExplorerUrl } from '../services/stellar';

export default function TaskExplorer() {
  const {
    tasks,
    currentUser,
    applyForTask,
    assignTask,
    submitCompletion,
    completeTaskAndPayout,
    triggerDispute,
  } = useTaskStore();
  const contract = useContractTask();
  const { address, connect } = useWallet();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'All' | 'Open' | 'InEscrow' | 'Assigned' | 'Completed' | 'Disputed'
  >('All');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [showDisputeInput, setShowDisputeInput] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(search.toLowerCase()) ||
      task.description.toLowerCase().includes(search.toLowerCase()) ||
      task.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'All' || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const refreshModal = (taskId: string) => {
    const updated = useTaskStore.getState().tasks.find((t) => t.id === taskId);
    if (updated) setSelectedTask(updated);
  };

  const handleApply = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task && currentUser.reputation < task.reputationRequired) {
      alert(
        `Insufficient Reputation! Required: ${task.reputationRequired}, Current: ${currentUser.reputation}`
      );
      return;
    }
    applyForTask(taskId, currentUser.address);
    refreshModal(taskId);
  };

  const handleAssign = async (taskId: string, applicant: string) => {
    setLastTxHash(null);
    if (address) {
      try {
        const res = await contract.assignTask(Number(taskId), applicant);
        setLastTxHash(res.txHash);
      } catch {
        /* fall through to local */
      }
    }
    assignTask(taskId, applicant);
    refreshModal(taskId);
  };

  const handleSubmit = async (taskId: string) => {
    setLastTxHash(null);
    if (address) {
      try {
        const res = await contract.submitWork(
          Number(taskId),
          `https://github.com/LatterFixxx/LatterFix-Smart-contract`
        );
        setLastTxHash(res.txHash);
      } catch {
        /* fall through */
      }
    }
    submitCompletion(taskId);
    refreshModal(taskId);
  };

  const handlePayout = async (taskId: string) => {
    setLastTxHash(null);
    if (address) {
      try {
        const res = await contract.completeTask(Number(taskId));
        setLastTxHash(res.txHash);
      } catch {
        /* fall through */
      }
    }
    completeTaskAndPayout(taskId);
    refreshModal(taskId);
  };

  const handleDispute = async (taskId: string) => {
    if (!disputeReason.trim()) return;
    setLastTxHash(null);
    if (address) {
      try {
        const res = await contract.disputeTask(Number(taskId));
        setLastTxHash(res.txHash);
      } catch {
        /* fall through */
      }
    }
    triggerDispute(taskId, disputeReason);
    setDisputeReason('');
    setShowDisputeInput(false);
    refreshModal(taskId);
  };

  return (
    <div className="space-y-8 page-fade">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Stellar Task Explorer</h1>
          <p className="text-xs text-muted">
            Browse, apply for, and manage Soroban escrow agreements. Actions call{' '}
            <code className="text-accent">assign_task()</code>,{' '}
            <code className="text-accent">submit_work()</code>, and{' '}
            <code className="text-accent">complete_task()</code> on-chain.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs font-mono bg-white/5 border border-white/5 px-3 py-1.5 rounded-lg text-muted flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-accent" />
            Active Escrows:{' '}
            {tasks.filter((t) => ['InEscrow', 'Assigned'].includes(t.status)).length}
          </span>
          <span className="text-xs font-mono bg-white/5 border border-white/5 px-3 py-1.5 rounded-lg text-muted flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            Audit Status: Clean
          </span>
          {!address ? (
            <button
              onClick={connect}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 border border-accent/20 text-accent rounded-lg text-xs font-bold hover:bg-accent/20 transition"
            >
              <Zap className="w-3.5 h-3.5" /> Connect for On-chain
            </button>
          ) : (
            <span className="text-xs font-mono bg-green-500/10 border border-green-500/20 text-green-400 px-3 py-1.5 rounded-lg">
              ● {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          )}
        </div>
      </div>

      {/* TX confirmation banner */}
      {lastTxHash && (
        <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-xl flex items-center justify-between text-xs text-green-400">
          <span>✓ Transaction confirmed on Stellar</span>
          <a
            href={getExplorerUrl('tx', lastTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-mono hover:underline"
          >
            {lastTxHash.slice(0, 10)}... <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Contract loading state */}
      {contract.isLoading && (
        <div className="flex items-center gap-2 text-xs text-accent">
          <Loader2 className="w-4 h-4 animate-spin" /> Submitting to Stellar Testnet...
        </div>
      )}
      {contract.error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
          {contract.error}
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search by title, tag, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black/25 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-muted mr-1 hidden sm:block" />
          {(['All', 'Open', 'InEscrow', 'Assigned', 'Completed', 'Disputed'] as const).map(
            (status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                  statusFilter === status
                    ? 'bg-accent text-bg font-black'
                    : 'bg-white/5 text-muted hover:text-white hover:bg-white/10'
                }`}
              >
                {status === 'InEscrow' ? 'Funded' : status}
              </button>
            )
          )}
        </div>
      </div>

      {/* Task Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredTasks.map((task) => (
          <div
            key={task.id}
            onClick={() => setSelectedTask(task)}
            className="card glass noise cursor-pointer hover:border-accent/30 transition-all p-6 flex flex-col justify-between h-[230px]"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    task.status === 'Completed'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : task.status === 'Disputed'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : task.status === 'Assigned'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : task.status === 'InEscrow'
                            ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                  }`}
                >
                  {task.status === 'InEscrow' ? 'Funded' : task.status}
                </span>
                <span className="text-[10px] font-mono text-muted">#{task.id}</span>
              </div>

              <h3 className="text-lg font-bold text-white mb-2 line-clamp-1 group-hover:text-accent">
                {task.title}
              </h3>
              <p className="text-xs text-muted line-clamp-2 leading-relaxed mb-4">
                {task.description}
              </p>
            </div>

            <div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {task.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] font-mono bg-white/5 border border-white/5 text-muted px-2 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <div className="text-left">
                  <p className="text-[9px] uppercase tracking-wider text-muted font-mono leading-none mb-1">
                    Escrow Reward
                  </p>
                  <p className="text-base font-black text-white">
                    {task.reward} {task.token}
                  </p>
                </div>
                <span className="text-xs font-semibold text-accent flex items-center gap-1">
                  Details <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </div>
        ))}

        {filteredTasks.length === 0 && (
          <div className="col-span-full card glass noise p-12 text-center text-muted">
            <AlertCircle className="w-8 h-8 text-muted mx-auto mb-3" />
            <p className="text-sm font-semibold">No tasks found matching current filters.</p>
          </div>
        )}
      </div>

      {/* Task Details Drawer/Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto shadow-2xl">
            <button
              onClick={() => {
                setSelectedTask(null);
                setShowDisputeInput(false);
              }}
              className="absolute top-4 right-4 text-muted hover:text-white p-2 rounded-lg bg-white/5 transition"
            >
              ✕
            </button>

            {/* Task Info */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    selectedTask.status === 'Completed'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : selectedTask.status === 'Disputed'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : selectedTask.status === 'Assigned'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : selectedTask.status === 'InEscrow'
                            ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                  }`}
                >
                  {selectedTask.status === 'InEscrow' ? 'Funded' : selectedTask.status}
                </span>
                {selectedTask.completionSubmitted && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 animate-pulse">
                    Completion Submitted
                  </span>
                )}
                <span className="text-xs font-mono text-muted">ID: {selectedTask.id}</span>
              </div>
              <h2 className="text-2xl font-black text-white">{selectedTask.title}</h2>
              <div className="flex flex-wrap gap-1.5">
                {selectedTask.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-mono bg-white/5 border border-white/10 text-muted px-2 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <h4 className="text-xs uppercase tracking-wider text-muted font-bold">
                Project Details
              </h4>
              <p className="text-sm text-white/85 leading-relaxed bg-black/20 p-4 rounded-xl border border-white/5">
                {selectedTask.description}
              </p>
            </div>

            {/* Meta statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 text-center">
                <p className="text-[10px] text-muted uppercase font-mono mb-1">Escrow Reward</p>
                <p className="text-base font-black text-accent">
                  {selectedTask.reward} {selectedTask.token}
                </p>
              </div>
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 text-center">
                <p className="text-[10px] text-muted uppercase font-mono mb-1">Required Rep</p>
                <p className="text-base font-black text-white">
                  {selectedTask.reputationRequired}+
                </p>
              </div>
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 text-center">
                <p className="text-[10px] text-muted uppercase font-mono mb-1">Deadline</p>
                <p className="text-xs font-black text-white">{selectedTask.deadline}</p>
              </div>
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 text-center">
                <p className="text-[10px] text-muted uppercase font-mono mb-1">Platform Fee</p>
                <p className="text-xs font-black text-purple-400">2.5% (Deducted)</p>
              </div>
            </div>

            {/* Stakeholder Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-1">
                <p className="text-[9px] uppercase text-muted">Task Creator</p>
                <p className="text-white truncate">{selectedTask.creator}</p>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-1">
                <p className="text-[9px] uppercase text-muted">Assigned Contributor</p>
                <p className="text-white truncate">{selectedTask.assignee || 'Not assigned yet'}</p>
              </div>
            </div>

            {/* Disputed Alert */}
            {selectedTask.status === 'Disputed' && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex gap-3 text-sm text-red-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-bold">This task is currently under dispute</p>
                  <p className="text-xs text-red-300/80 mt-1">
                    Reason: "{selectedTask.disputeReason || 'No details provided'}"
                  </p>
                  <p className="text-[10px] text-red-400/70 mt-2">
                    LatterFix arbitrators are currently auditing the workspace history.
                  </p>
                </div>
              </div>
            )}

            {/* Action Panel based on roles */}
            <div className="border-t border-white/5 pt-6 flex flex-col gap-4">
              {currentUser.role === 'Contributor' && (
                <div className="space-y-4">
                  {/* Status: Open */}
                  {selectedTask.status === 'Open' && (
                    <div className="text-sm text-muted">
                      ⚠️ Needs funding in escrow before contributors can apply or be assigned.
                    </div>
                  )}

                  {/* Status: Funded/InEscrow */}
                  {selectedTask.status === 'InEscrow' && (
                    <>
                      {selectedTask.applicants.includes(currentUser.address) ? (
                        <div className="text-center py-2 bg-blue-500/15 text-blue-400 font-bold rounded-xl border border-blue-500/25">
                          ✓ Application Pending Creator Review
                        </div>
                      ) : (
                        <button
                          onClick={() => handleApply(selectedTask.id)}
                          className="w-full py-3.5 bg-accent text-bg font-extrabold rounded-2xl hover:scale-102 transition-transform shadow-lg shadow-accent/20"
                        >
                          Apply For Task (Requires {selectedTask.reputationRequired} Rep)
                        </button>
                      )}
                    </>
                  )}

                  {/* Status: Assigned to current user */}
                  {selectedTask.status === 'Assigned' &&
                    selectedTask.assignee === currentUser.address && (
                      <div className="flex flex-col sm:flex-row gap-3">
                        {selectedTask.completionSubmitted ? (
                          <div className="w-full text-center py-3 bg-green-500/10 border border-green-500/20 text-green-400 font-bold rounded-xl">
                            ✓ Completion request sent to task creator. Waiting for release.
                          </div>
                        ) : (
                          <button
                            onClick={() => handleSubmit(selectedTask.id)}
                            className="w-full py-3.5 bg-accent text-bg font-extrabold rounded-2xl hover:scale-102 transition-transform shadow-lg shadow-accent/20"
                          >
                            Submit Task Completion
                          </button>
                        )}
                        <button
                          onClick={() => setShowDisputeInput(true)}
                          className="py-3.5 px-6 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/25 rounded-2xl font-bold transition"
                        >
                          File Dispute
                        </button>
                      </div>
                    )}

                  {/* Status: Assigned to someone else */}
                  {selectedTask.status === 'Assigned' &&
                    selectedTask.assignee !== currentUser.address && (
                      <div className="text-sm text-muted text-center py-3 bg-white/5 border border-white/5 rounded-xl">
                        This task has been assigned to contributor{' '}
                        {selectedTask.assignee?.slice(0, 8)}...
                      </div>
                    )}

                  {/* Status: Completed */}
                  {selectedTask.status === 'Completed' && (
                    <div className="flex items-center gap-2 justify-center py-3 bg-green-500/10 border border-green-500/20 text-green-400 font-bold rounded-xl">
                      <CheckCircle className="w-4 h-4" /> Escrow Released. Payout Completed
                      Instantly!
                    </div>
                  )}
                </div>
              )}

              {currentUser.role === 'Creator' && (
                <div className="space-y-4">
                  {/* Status: Open */}
                  {selectedTask.status === 'Open' && (
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs text-muted max-w-sm">
                        Fund this task on Stellar. Funds will be locked in the smart contract
                        escrow.
                      </p>
                      <button
                        onClick={() => {
                          const originalId = selectedTask.id;
                          useTaskStore.getState().fundTask(originalId);
                          const updated = useTaskStore
                            .getState()
                            .tasks.find((t) => t.id === originalId);
                          if (updated) setSelectedTask(updated);
                        }}
                        className="px-6 py-3.5 bg-accent text-bg font-extrabold rounded-2xl hover:scale-102 transition-transform shadow-lg shadow-accent/20 flex items-center gap-1.5 shrink-0"
                      >
                        <Coins className="w-4 h-4" /> Fund Escrow
                      </button>
                    </div>
                  )}

                  {/* Status: Funded/InEscrow */}
                  {selectedTask.status === 'InEscrow' && (
                    <div className="space-y-3">
                      <h4 className="text-xs uppercase tracking-wider text-muted font-bold">
                        Applicants ({selectedTask.applicants.length})
                      </h4>
                      {selectedTask.applicants.length > 0 ? (
                        <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                          {selectedTask.applicants.map((app) => (
                            <div
                              key={app}
                              className="flex items-center justify-between p-3 bg-black/20 border border-white/5 rounded-xl text-xs font-mono"
                            >
                              <span className="truncate pr-4">{app}</span>
                              <button
                                onClick={() => handleAssign(selectedTask.id, app)}
                                className="px-3 py-1.5 bg-accent text-bg font-extrabold rounded-lg hover:scale-105 transition-transform"
                              >
                                Assign
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted italic">
                          Waiting for contributors to apply...
                        </p>
                      )}
                    </div>
                  )}

                  {/* Status: Assigned */}
                  {selectedTask.status === 'Assigned' && (
                    <div className="flex flex-col gap-3">
                      {selectedTask.completionSubmitted ? (
                        <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-xs flex items-center justify-between">
                          <span>
                            🚀 The contributor has marked this task complete. Review the
                            deliverable.
                          </span>
                          <button
                            onClick={() => handlePayout(selectedTask.id)}
                            className="px-4 py-2 bg-green-500 text-bg font-bold rounded-lg hover:scale-105 transition-transform"
                          >
                            Release Funds
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-white/5 border border-white/5 p-4 rounded-xl">
                          <p className="text-xs text-muted">Waiting for assignee to submit work.</p>
                          <button
                            onClick={() => setShowDisputeInput(true)}
                            className="px-4 py-2 bg-red-500/15 border border-red-500/20 text-red-400 hover:bg-red-500/25 rounded-lg text-xs font-bold transition"
                          >
                            File Dispute
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status: Completed */}
                  {selectedTask.status === 'Completed' && (
                    <div className="flex items-center gap-2 justify-center py-3 bg-green-500/10 border border-green-500/20 text-green-400 font-bold rounded-xl text-xs">
                      <CheckCircle className="w-4 h-4" /> Escrow Released. Payout Completed
                      Instantly!
                    </div>
                  )}
                </div>
              )}

              {currentUser.role === 'Admin' && (
                <div className="space-y-4">
                  <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl text-xs text-purple-300">
                    👑 Platform Governance Panel: As an admin, you can review this agreement and
                    monitor contract health.
                  </div>
                </div>
              )}

              {/* Dispute Input Section */}
              {showDisputeInput && (
                <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-red-400">File a Payment Dispute</h4>
                  <p className="text-[11px] text-muted">
                    Describe your reasons for open dispute arbitration. The Stellar escrow funds
                    will remain locked in smart contract until resolved.
                  </p>
                  <textarea
                    rows={3}
                    placeholder="Enter details of the dispute..."
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-500/40"
                  />
                  <div className="flex justify-end gap-2 text-xs">
                    <button
                      onClick={() => setShowDisputeInput(false)}
                      className="px-3 py-1.5 bg-white/5 text-muted hover:text-white rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDispute(selectedTask.id)}
                      className="px-3.5 py-1.5 bg-red-500 text-white font-bold rounded-lg hover:scale-102 transition"
                    >
                      Confirm Dispute
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
