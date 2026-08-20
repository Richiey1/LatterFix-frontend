/**
 * useContractTask
 *
 * The primary React hook for interacting with the LatterFix Soroban
 * TaskManager contract. Each action:
 *   1. Verifies wallet is connected
 *   2. Builds the prepared XDR using sorobanTaskContract.ts
 *   3. Sends XDR to the connected wallet for signing (Freighter / xBull / Lobstr)
 *   4. Submits the signed transaction and polls for confirmation
 *   5. Returns the transaction hash and decoded result
 *
 * This hook replaces the purely client-side taskStore mutations for on-chain
 * operations. The local taskStore still manages UI optimistic state.
 */

import { useCallback, useState } from 'react';
import { useWallet } from './useWallet';
import { useNotification } from './useNotification';
import {
  buildCreateTaskTx,
  buildCreateTaskWithMilestonesTx,
  buildAssignTaskTx,
  buildSubmitWorkTx,
  buildCompleteTaskTx,
  buildCancelTaskTx,
  buildDisputeTaskTx,
  buildResolveDisputeTx,
  buildSubmitMilestoneTx,
  buildApproveMilestoneTx,
  buildRejectMilestoneTx,
  buildCreateProposalTx,
  buildCastVoteTx,
  buildExecuteProposalTx,
  buildGrantRoleTx,
  buildRevokeRoleTx,
  buildPauseAllTx,
  buildUnpauseAllTx,
  buildCreateProfileTx,
  buildUpdateBioTx,
  submitAndPollSorobanTx,
  queryGetTask,
  queryGetStatistics,
  queryGetEscrowStats,
  queryGetProfile,
  queryGetUserReputation,
  queryGetUserTier,
  queryGetLeaderboard,
  queryGetActiveProposals,
  queryGetMilestones,
  type PreparedTxResult,
  type SubmitResult,
} from '../services/sorobanTaskContract';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContractActionState {
  isLoading: boolean;
  error: string | null;
  lastTxHash: string | null;
  lastResult: unknown;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useContractTask() {
  const { address, requireWallet, signTransaction } = useWallet();
  const { notifySuccess, notifyError, notify } = useNotification();

  const [state, setState] = useState<ContractActionState>({
    isLoading: false,
    error: null,
    lastTxHash: null,
    lastResult: null,
  });

  // ── Core sign-and-submit pipeline ──────────────────────────────────────
  const signAndSubmit = useCallback(
    async (preparedResult: PreparedTxResult, successMessage: string): Promise<SubmitResult> => {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        notify(`Signing: ${preparedResult.summary}`);

        const signedXdr = await signTransaction(preparedResult.preparedXdr);
        notify('Submitting to Stellar network...');

        const result = await submitAndPollSorobanTx(signedXdr);
        notifySuccess(successMessage, `TX: ${result.txHash.slice(0, 12)}...`);

        setState({
          isLoading: false,
          error: null,
          lastTxHash: result.txHash,
          lastResult: result.value,
        });

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Contract call failed';
        notifyError('Transaction failed', message);
        setState((s) => ({ ...s, isLoading: false, error: message }));
        throw err;
      }
    },
    [notify, notifyError, notifySuccess, signTransaction]
  );

  // ── Task Actions ────────────────────────────────────────────────────────

  const createTask = useCallback(
    async (
      title: string,
      description: string,
      rewardStroops: bigint,
      tags: string[]
    ): Promise<SubmitResult> => {
      const caller = await requireWallet();
      if (!caller) throw new Error('Wallet not connected');

      const prepared = await buildCreateTaskTx(caller, title, description, rewardStroops, tags);
      return signAndSubmit(prepared, `Task "${title}" created and funded in escrow`);
    },
    [requireWallet, signAndSubmit]
  );

  const createTaskWithMilestones = useCallback(
    async (
      title: string,
      description: string,
      milestones: { title: string; amount: bigint }[],
      tags: string[]
    ): Promise<SubmitResult> => {
      const caller = await requireWallet();
      if (!caller) throw new Error('Wallet not connected');

      const prepared = await buildCreateTaskWithMilestonesTx(
        caller,
        title,
        description,
        milestones,
        tags
      );
      return signAndSubmit(prepared, `Milestoned task "${title}" created`);
    },
    [requireWallet, signAndSubmit]
  );

  const assignTask = useCallback(
    async (taskId: number, assignee?: string): Promise<SubmitResult> => {
      const caller = await requireWallet();
      if (!caller) throw new Error('Wallet not connected');

      const targetAssignee = assignee || caller;
      const prepared = await buildAssignTaskTx(targetAssignee, taskId);
      return signAndSubmit(prepared, `Task #${taskId} assigned successfully`);
    },
    [requireWallet, signAndSubmit]
  );

  const submitWork = useCallback(
    async (taskId: number, deliveryUrl: string): Promise<SubmitResult> => {
      const caller = await requireWallet();
      if (!caller) throw new Error('Wallet not connected');

      const prepared = await buildSubmitWorkTx(caller, taskId, deliveryUrl);
      return signAndSubmit(prepared, `Work submitted for task #${taskId}`);
    },
    [requireWallet, signAndSubmit]
  );

  const completeTask = useCallback(
    async (taskId: number): Promise<SubmitResult> => {
      const caller = await requireWallet();
      if (!caller) throw new Error('Wallet not connected');

      const prepared = await buildCompleteTaskTx(caller, taskId);
      return signAndSubmit(prepared, `Task #${taskId} completed — funds released`);
    },
    [requireWallet, signAndSubmit]
  );

  const cancelTask = useCallback(
    async (taskId: number): Promise<SubmitResult> => {
      const caller = await requireWallet();
      if (!caller) throw new Error('Wallet not connected');

      const prepared = await buildCancelTaskTx(caller, taskId);
      return signAndSubmit(prepared, `Task #${taskId} cancelled — funds refunded`);
    },
    [requireWallet, signAndSubmit]
  );

  const disputeTask = useCallback(
    async (taskId: number): Promise<SubmitResult> => {
      const caller = await requireWallet();
      if (!caller) throw new Error('Wallet not connected');

      const prepared = await buildDisputeTaskTx(caller, taskId);
      return signAndSubmit(prepared, `Dispute raised for task #${taskId}`);
    },
    [requireWallet, signAndSubmit]
  );

  const resolveDispute = useCallback(
    async (
      taskId: number,
      creatorRefundStroops: bigint,
      assigneePayoutStroops: bigint
    ): Promise<SubmitResult> => {
      const caller = await requireWallet();
      if (!caller) throw new Error('Wallet not connected');

      const prepared = await buildResolveDisputeTx(
        caller,
        taskId,
        creatorRefundStroops,
        assigneePayoutStroops
      );
      return signAndSubmit(prepared, `Dispute for task #${taskId} resolved`);
    },
    [requireWallet, signAndSubmit]
  );

  // ── Milestone Actions ───────────────────────────────────────────────────

  const submitMilestone = useCallback(
    async (taskId: number, milestoneId: number, submissionUrl: string): Promise<SubmitResult> => {
      const caller = await requireWallet();
      if (!caller) throw new Error('Wallet not connected');

      const prepared = await buildSubmitMilestoneTx(caller, taskId, milestoneId, submissionUrl);
      return signAndSubmit(prepared, `Milestone #${milestoneId} submitted`);
    },
    [requireWallet, signAndSubmit]
  );

  const approveMilestone = useCallback(
    async (taskId: number, milestoneId: number, feedback?: string): Promise<SubmitResult> => {
      const caller = await requireWallet();
      if (!caller) throw new Error('Wallet not connected');

      const prepared = await buildApproveMilestoneTx(caller, taskId, milestoneId, feedback);
      return signAndSubmit(prepared, `Milestone #${milestoneId} approved — payment released`);
    },
    [requireWallet, signAndSubmit]
  );

  const rejectMilestone = useCallback(
    async (taskId: number, milestoneId: number, feedback: string): Promise<SubmitResult> => {
      const caller = await requireWallet();
      if (!caller) throw new Error('Wallet not connected');

      const prepared = await buildRejectMilestoneTx(caller, taskId, milestoneId, feedback);
      return signAndSubmit(prepared, `Milestone #${milestoneId} rejected`);
    },
    [requireWallet, signAndSubmit]
  );

  // ── Governance Actions ──────────────────────────────────────────────────

  const createProposal = useCallback(
    async (title: string, description: string): Promise<SubmitResult> => {
      const caller = await requireWallet();
      if (!caller) throw new Error('Wallet not connected');

      const prepared = await buildCreateProposalTx(caller, title, description);
      return signAndSubmit(prepared, `Proposal "${title}" submitted for on-chain vote`);
    },
    [requireWallet, signAndSubmit]
  );

  const castVote = useCallback(
    async (proposalId: number, voteType: 'For' | 'Against' | 'Abstain'): Promise<SubmitResult> => {
      const caller = await requireWallet();
      if (!caller) throw new Error('Wallet not connected');

      const prepared = await buildCastVoteTx(caller, proposalId, voteType);
      return signAndSubmit(prepared, `Voted ${voteType} on proposal #${proposalId}`);
    },
    [requireWallet, signAndSubmit]
  );

  const executeProposal = useCallback(
    async (proposalId: number): Promise<SubmitResult> => {
      const caller = await requireWallet();
      if (!caller) throw new Error('Wallet not connected');

      const prepared = await buildExecuteProposalTx(caller, proposalId);
      return signAndSubmit(prepared, `Proposal #${proposalId} executed on-chain`);
    },
    [requireWallet, signAndSubmit]
  );

  // ── Access Control ──────────────────────────────────────────────────────

  const grantRole = useCallback(
    async (
      userAddress: string,
      role: 'Admin' | 'Moderator' | 'Verifier'
    ): Promise<SubmitResult> => {
      const caller = await requireWallet();
      if (!caller) throw new Error('Wallet not connected');

      const prepared = await buildGrantRoleTx(caller, userAddress, role);
      return signAndSubmit(prepared, `${role} role granted to ${userAddress.slice(0, 6)}...`);
    },
    [requireWallet, signAndSubmit]
  );

  const revokeRole = useCallback(
    async (userAddress: string): Promise<SubmitResult> => {
      const caller = await requireWallet();
      if (!caller) throw new Error('Wallet not connected');

      const prepared = await buildRevokeRoleTx(caller, userAddress);
      return signAndSubmit(prepared, `Role revoked from ${userAddress.slice(0, 6)}...`);
    },
    [requireWallet, signAndSubmit]
  );

  // ── Emergency Pause ─────────────────────────────────────────────────────

  const pauseAll = useCallback(async (): Promise<SubmitResult> => {
    const caller = await requireWallet();
    if (!caller) throw new Error('Wallet not connected');

    const prepared = await buildPauseAllTx(caller);
    return signAndSubmit(prepared, 'Contract emergency pause activated');
  }, [requireWallet, signAndSubmit]);

  const unpauseAll = useCallback(async (): Promise<SubmitResult> => {
    const caller = await requireWallet();
    if (!caller) throw new Error('Wallet not connected');

    const prepared = await buildUnpauseAllTx(caller);
    return signAndSubmit(prepared, 'Contract resumed — all operations active');
  }, [requireWallet, signAndSubmit]);

  // ── Profile ─────────────────────────────────────────────────────────────

  const createProfile = useCallback(
    async (username: string, bio: string): Promise<SubmitResult> => {
      const caller = await requireWallet();
      if (!caller) throw new Error('Wallet not connected');

      const prepared = await buildCreateProfileTx(caller, username, bio);
      return signAndSubmit(prepared, `Profile "${username}" created on-chain`);
    },
    [requireWallet, signAndSubmit]
  );

  const updateBio = useCallback(
    async (newBio: string): Promise<SubmitResult> => {
      const caller = await requireWallet();
      if (!caller) throw new Error('Wallet not connected');

      const prepared = await buildUpdateBioTx(caller, newBio);
      return signAndSubmit(prepared, 'Profile bio updated on-chain');
    },
    [requireWallet, signAndSubmit]
  );

  // ── Read Queries (no signing) ────────────────────────────────────────────

  const getTask = useCallback((taskId: number) => queryGetTask(taskId), []);
  const getStatistics = useCallback(() => queryGetStatistics(), []);
  const getEscrowStats = useCallback(() => queryGetEscrowStats(), []);
  const getProfile = useCallback(
    (userAddr?: string) => queryGetProfile(userAddr ?? address ?? ''),
    [address]
  );
  const getUserReputation = useCallback(
    (userAddr?: string) => queryGetUserReputation(userAddr ?? address ?? ''),
    [address]
  );
  const getUserTier = useCallback(
    (userAddr?: string) => queryGetUserTier(userAddr ?? address ?? ''),
    [address]
  );
  const getLeaderboard = useCallback(() => queryGetLeaderboard(), []);
  const getActiveProposals = useCallback(() => queryGetActiveProposals(), []);
  const getMilestones = useCallback((taskId: number) => queryGetMilestones(taskId), []);

  return {
    // State
    ...state,
    isWalletConnected: !!address,
    walletAddress: address,

    // Task actions (on-chain)
    createTask,
    createTaskWithMilestones,
    assignTask,
    submitWork,
    completeTask,
    cancelTask,
    disputeTask,
    resolveDispute,

    // Milestone actions (on-chain)
    submitMilestone,
    approveMilestone,
    rejectMilestone,

    // Governance (on-chain)
    createProposal,
    castVote,
    executeProposal,

    // Access control (on-chain)
    grantRole,
    revokeRole,

    // Emergency (on-chain)
    pauseAll,
    unpauseAll,

    // Profile (on-chain)
    createProfile,
    updateBio,

    // Read-only queries
    getTask,
    getStatistics,
    getEscrowStats,
    getProfile,
    getUserReputation,
    getUserTier,
    getLeaderboard,
    getActiveProposals,
    getMilestones,
  };
}
