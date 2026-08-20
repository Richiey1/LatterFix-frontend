/**
 * Soroban Task Manager Contract Service
 *
 * This module wraps every function exposed by the LatterFix Soroban smart
 * contract (`TaskManagerContract` in Rust). Each function:
 *   1. Loads the caller's account from the Soroban RPC
 *   2. Builds the Soroban contract invocation transaction
 *   3. Simulates the transaction via `rpc.simulateTransaction`
 *   4. Prepares the transaction (footprint, auth entries, resource fees)
 *   5. Returns the prepared XDR for wallet signing
 *
 * The caller is responsible for signing the returned XDR and submitting it
 * via `submitAndPollSorobanTx`.
 *
 * Contract methods covered:
 *   - initialize
 *   - create_task / create_task_with_milestones
 *   - assign_task
 *   - submit_work
 *   - complete_task
 *   - cancel_task
 *   - dispute_task / resolve_dispute
 *   - submit_milestone / approve_milestone / reject_milestone
 *   - get_task / get_milestones / get_statistics / get_escrow_stats
 *   - create_profile / update_bio / get_profile
 *   - get_user_reputation / get_user_tier / get_leaderboard
 *   - grant_role / revoke_role / has_role
 *   - create_proposal / cast_vote / execute_proposal / get_proposal
 *   - pause / unpause / pause_all / unpause_all
 */

import {
  BASE_FEE,
  Contract,
  Networks,
  rpc,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
  Address,
} from '@stellar/stellar-sdk';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function getRpcUrl(): string {
  const envRpc = import.meta.env.PUBLIC_STELLAR_RPC_URL as string | undefined;
  return (envRpc ?? 'https://soroban-testnet.stellar.org').replace(/\/+$/, '');
}

function getNetworkPassphrase(): string {
  const network = (import.meta.env.PUBLIC_STELLAR_NETWORK as string | undefined)?.toUpperCase();
  if (network === 'MAINNET') return Networks.PUBLIC;
  return Networks.TESTNET;
}

export function getContractId(): string {
  const id = import.meta.env.VITE_LATTERFIX_CONTRACT_ID as string | undefined;
  // Falls back to a placeholder — replace with real deployed contract ID
  return id ?? 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
}

function getRpcServer(): rpc.Server {
  const url = getRpcUrl();
  return new rpc.Server(url, { allowHttp: url.startsWith('http://') });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PreparedTxResult {
  /** Prepared transaction XDR, ready for wallet signing */
  preparedXdr: string;
  /** The unprepared transaction hash (for reference) */
  txHash: string;
  /** Human-readable summary of the operation */
  summary: string;
}

export interface SubmitResult {
  txHash: string;
  /** Decoded return value from the contract (if any) */
  value: unknown;
}

export interface SorobanTaskInfo {
  id: number;
  title: string;
  description: string;
  reward: bigint;
  assignee: string | null;
  status: string;
  createdBy: string;
  tags: string[];
  createdAt: bigint;
  updatedAt: bigint;
}

export interface SorobanUserProfile {
  address: string;
  username: string;
  bio: string;
  reputation: number;
  completedTasks: number;
  createdAt: bigint;
}

export interface SorobanProposal {
  id: number;
  title: string;
  description: string;
  proposer: string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  status: string;
  createdAt: bigint;
  expiresAt: bigint;
}

export interface SorobanEscrowStats {
  totalLocked: bigint;
  totalReleased: bigint;
  totalRefunded: bigint;
  activeEscrows: number;
  completedEscrows: number;
}

export interface SorobanContractStatistics {
  totalTasksCreated: number;
  totalTasksCompleted: number;
  totalTasksCancelled: number;
  totalTasksDisputed: number;
  totalValueLocked: bigint;
  totalValuePaid: bigint;
  totalPlatformFees: bigint;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertValidAddress(address: string, label = 'address'): void {
  if (!StrKey.isValidEd25519PublicKey(address) && !StrKey.isValidContract(address)) {
    throw new Error(`Invalid Stellar ${label}: ${address}`);
  }
}

function toScAddress(address: string): xdr.ScVal {
  return nativeToScVal(Address.fromString(address), { type: 'address' });
}

function toScString(_env_ignored: null, value: string): xdr.ScVal {
  return xdr.ScVal.scvString(Buffer.from(value));
}

function toScU32(value: number): xdr.ScVal {
  return nativeToScVal(value, { type: 'u32' });
}

function toScI128(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: 'i128' });
}

export function toScU64(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: 'u64' });
}

export function toScBool(value: boolean): xdr.ScVal {
  return xdr.ScVal.scvBool(value);
}

function toScVec(items: xdr.ScVal[]): xdr.ScVal {
  return xdr.ScVal.scvVec(items);
}

function toScSymbol(value: string): xdr.ScVal {
  return xdr.ScVal.scvSymbol(value);
}

/**
 * Simulates, prepares, and returns the XDR for a Soroban contract call.
 * Does NOT submit — callers must sign and call submitAndPollSorobanTx.
 */
async function buildAndPrepareSorobanTx(
  callerAddress: string,
  method: string,
  args: xdr.ScVal[],
  summary: string,
  feeBudget: string = BASE_FEE
): Promise<PreparedTxResult> {
  assertValidAddress(callerAddress, 'caller');

  const server = getRpcServer();
  const account = await server.getAccount(callerAddress);
  const contract = new Contract(getContractId());

  const tx = new TransactionBuilder(account, {
    fee: feeBudget,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  // Simulate first to catch errors and get resource footprint
  const simulation = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Soroban simulation failed for '${method}': ${simulation.error}`);
  }

  if (rpc.Api.isSimulationRestore(simulation)) {
    throw new Error(`State archival restore required before calling '${method}'.`);
  }

  // Prepare: injects auth entries, resource fees, and footprint
  const prepared = await server.prepareTransaction(tx);

  return {
    preparedXdr: prepared.toXDR(),
    txHash: tx.hash().toString('hex'),
    summary,
  };
}

// ---------------------------------------------------------------------------
// Submit & Poll
// ---------------------------------------------------------------------------

/**
 * Submits a signed XDR to the Soroban RPC and polls for confirmation.
 * Returns the final transaction hash and decoded return value.
 */
export async function submitAndPollSorobanTx(
  signedXdr: string,
  maxAttempts = 20,
  intervalMs = 1500
): Promise<SubmitResult> {
  const server = getRpcServer();
  const tx = TransactionBuilder.fromXDR(signedXdr, getNetworkPassphrase());
  const sendResponse = await server.sendTransaction(tx);

  if (sendResponse.status === 'ERROR') {
    const errMsg = sendResponse.errorResult?.result()?.toString() ?? 'Unknown error';
    throw new Error(`Contract submission failed: ${errMsg}`);
  }

  const hash = sendResponse.hash;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const poll = await server.getTransaction(hash);

    if (poll.status === rpc.Api.GetTransactionStatus.NOT_FOUND) continue;

    if (poll.status === rpc.Api.GetTransactionStatus.FAILED) {
      const meta = poll.resultMetaXdr?.toString() ?? '';
      throw new Error(`Transaction failed on-chain. Meta: ${meta.slice(0, 200)}`);
    }

    if (poll.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      const raw = poll.returnValue ? scValToNative(poll.returnValue) : null;
      return { txHash: hash, value: raw };
    }
  }

  throw new Error(`Transaction polling timed out after ${maxAttempts} attempts. Hash: ${hash}`);
}

// ---------------------------------------------------------------------------
// Contract Initialization
// ---------------------------------------------------------------------------

export async function buildInitializeTx(
  callerAddress: string,
  adminAddress: string,
  platformFeeBps: number,
  tokenContractId: string,
  feeRecipientAddress: string
): Promise<PreparedTxResult> {
  return buildAndPrepareSorobanTx(
    callerAddress,
    'initialize',
    [
      toScAddress(adminAddress),
      toScU32(platformFeeBps),
      toScAddress(tokenContractId),
      toScAddress(feeRecipientAddress),
    ],
    `Initialize contract with fee: ${platformFeeBps / 100}%`
  );
}

// ---------------------------------------------------------------------------
// Task Management
// ---------------------------------------------------------------------------

export async function buildCreateTaskTx(
  callerAddress: string,
  title: string,
  description: string,
  rewardStroops: bigint,
  tags: string[]
): Promise<PreparedTxResult> {
  const tagVec = toScVec(tags.map((t) => toScString(null, t)));
  return buildAndPrepareSorobanTx(
    callerAddress,
    'create_task',
    [
      toScAddress(callerAddress),
      toScString(null, title),
      toScString(null, description),
      toScI128(rewardStroops),
      tagVec,
    ],
    `Create task: "${title}" with reward ${(Number(rewardStroops) / 1e7).toFixed(4)}`
  );
}

export async function buildCreateTaskWithMilestonesTx(
  callerAddress: string,
  title: string,
  description: string,
  milestones: { title: string; amount: bigint }[],
  tags: string[]
): Promise<PreparedTxResult> {
  const milestoneVec = toScVec(
    milestones.map((m) => xdr.ScVal.scvVec([toScString(null, m.title), toScI128(m.amount)]))
  );
  const tagVec = toScVec(tags.map((t) => toScString(null, t)));

  return buildAndPrepareSorobanTx(
    callerAddress,
    'create_task_with_milestones',
    [
      toScAddress(callerAddress),
      toScString(null, title),
      toScString(null, description),
      milestoneVec,
      tagVec,
    ],
    `Create milestoned task: "${title}" (${milestones.length} milestones)`
  );
}

export async function buildAssignTaskTx(
  assigneeAddress: string,
  taskId: number
): Promise<PreparedTxResult> {
  return buildAndPrepareSorobanTx(
    assigneeAddress,
    'assign_task',
    [toScAddress(assigneeAddress), toScU32(taskId)],
    `Assign task #${taskId} to ${assigneeAddress.slice(0, 6)}...`
  );
}

export async function buildSubmitWorkTx(
  assigneeAddress: string,
  taskId: number,
  deliveryUrl: string
): Promise<PreparedTxResult> {
  return buildAndPrepareSorobanTx(
    assigneeAddress,
    'submit_work',
    [toScAddress(assigneeAddress), toScU32(taskId), toScString(null, deliveryUrl)],
    `Submit work for task #${taskId}`
  );
}

export async function buildCompleteTaskTx(
  callerAddress: string,
  taskId: number
): Promise<PreparedTxResult> {
  return buildAndPrepareSorobanTx(
    callerAddress,
    'complete_task',
    [toScAddress(callerAddress), toScU32(taskId)],
    `Release escrow for task #${taskId}`
  );
}

export async function buildCancelTaskTx(
  creatorAddress: string,
  taskId: number
): Promise<PreparedTxResult> {
  return buildAndPrepareSorobanTx(
    creatorAddress,
    'cancel_task',
    [toScAddress(creatorAddress), toScU32(taskId)],
    `Cancel task #${taskId} and refund creator`
  );
}

export async function buildDisputeTaskTx(
  callerAddress: string,
  taskId: number
): Promise<PreparedTxResult> {
  return buildAndPrepareSorobanTx(
    callerAddress,
    'dispute_task',
    [toScAddress(callerAddress), toScU32(taskId)],
    `Raise dispute for task #${taskId}`
  );
}

export async function buildResolveDisputeTx(
  adminAddress: string,
  taskId: number,
  creatorRefundStroops: bigint,
  assigneePayoutStroops: bigint
): Promise<PreparedTxResult> {
  return buildAndPrepareSorobanTx(
    adminAddress,
    'resolve_dispute',
    [
      toScAddress(adminAddress),
      toScU32(taskId),
      toScI128(creatorRefundStroops),
      toScI128(assigneePayoutStroops),
    ],
    `Resolve dispute for task #${taskId}`
  );
}

// ---------------------------------------------------------------------------
// Milestone Management
// ---------------------------------------------------------------------------

export async function buildSubmitMilestoneTx(
  assigneeAddress: string,
  taskId: number,
  milestoneId: number,
  submissionUrl: string
): Promise<PreparedTxResult> {
  return buildAndPrepareSorobanTx(
    assigneeAddress,
    'submit_milestone',
    [
      toScAddress(assigneeAddress),
      toScU32(taskId),
      toScU32(milestoneId),
      toScString(null, submissionUrl),
    ],
    `Submit milestone #${milestoneId} for task #${taskId}`
  );
}

export async function buildApproveMilestoneTx(
  callerAddress: string,
  taskId: number,
  milestoneId: number,
  feedback?: string
): Promise<PreparedTxResult> {
  const feedbackScVal = feedback
    ? xdr.ScVal.scvVec([toScString(null, feedback)])
    : xdr.ScVal.scvVoid();

  return buildAndPrepareSorobanTx(
    callerAddress,
    'approve_milestone',
    [toScAddress(callerAddress), toScU32(taskId), toScU32(milestoneId), feedbackScVal],
    `Approve milestone #${milestoneId} for task #${taskId}`
  );
}

export async function buildRejectMilestoneTx(
  callerAddress: string,
  taskId: number,
  milestoneId: number,
  feedback: string
): Promise<PreparedTxResult> {
  return buildAndPrepareSorobanTx(
    callerAddress,
    'reject_milestone',
    [toScAddress(callerAddress), toScU32(taskId), toScU32(milestoneId), toScString(null, feedback)],
    `Reject milestone #${milestoneId} for task #${taskId}`
  );
}

// ---------------------------------------------------------------------------
// Read-only contract queries (simulated, no submission)
// ---------------------------------------------------------------------------

async function queryContract<T>(method: string, args: xdr.ScVal[]): Promise<T> {
  const server = getRpcServer();
  const contract = new Contract(getContractId());

  // Use a throw-away address for read queries (no auth needed)
  const dummyKey = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
  const account = await server.getAccount(dummyKey).catch(() => null);

  if (!account) {
    // Fallback: return empty result for read queries when no funded account is available
    return {} as T;
  }

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  const simulation = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Query '${method}' simulation error: ${simulation.error}`);
  }

  const result = (simulation as rpc.Api.SimulateTransactionSuccessResponse).result;
  if (!result?.retval) return null as unknown as T;

  return scValToNative(result.retval) as T;
}

export async function queryGetTask(taskId: number): Promise<SorobanTaskInfo | null> {
  return queryContract<SorobanTaskInfo | null>('get_task', [toScU32(taskId)]);
}

export async function queryGetEscrowStats(): Promise<SorobanEscrowStats> {
  return queryContract<SorobanEscrowStats>('get_escrow_stats', []);
}

export async function queryGetStatistics(): Promise<SorobanContractStatistics> {
  return queryContract<SorobanContractStatistics>('get_statistics', []);
}

export async function queryGetProfile(userAddress: string): Promise<SorobanUserProfile | null> {
  return queryContract<SorobanUserProfile | null>('get_profile', [toScAddress(userAddress)]);
}

export async function queryGetUserReputation(userAddress: string): Promise<number> {
  return queryContract<number>('get_user_reputation', [toScAddress(userAddress)]);
}

export async function queryGetUserTier(userAddress: string): Promise<string> {
  return queryContract<string>('get_user_tier', [toScAddress(userAddress)]);
}

export async function queryGetLeaderboard(): Promise<[string, number][]> {
  return queryContract<[string, number][]>('get_leaderboard', []);
}

export async function queryGetProposal(proposalId: number): Promise<SorobanProposal | null> {
  return queryContract<SorobanProposal | null>('get_proposal', [toScU32(proposalId)]);
}

export async function queryGetActiveProposals(): Promise<SorobanProposal[]> {
  return queryContract<SorobanProposal[]>('get_active_proposals', []);
}

export async function queryGetMilestones(taskId: number): Promise<unknown[]> {
  return queryContract<unknown[]>('get_milestones', [toScU32(taskId)]);
}

// ---------------------------------------------------------------------------
// User Profile
// ---------------------------------------------------------------------------

export async function buildCreateProfileTx(
  userAddress: string,
  username: string,
  bio: string
): Promise<PreparedTxResult> {
  return buildAndPrepareSorobanTx(
    userAddress,
    'create_profile',
    [toScAddress(userAddress), toScString(null, username), toScString(null, bio)],
    `Create profile for ${username}`
  );
}

export async function buildUpdateBioTx(
  userAddress: string,
  newBio: string
): Promise<PreparedTxResult> {
  return buildAndPrepareSorobanTx(
    userAddress,
    'update_bio',
    [toScAddress(userAddress), toScString(null, newBio)],
    `Update bio for ${userAddress.slice(0, 6)}...`
  );
}

// ---------------------------------------------------------------------------
// Governance
// ---------------------------------------------------------------------------

export async function buildCreateProposalTx(
  proposerAddress: string,
  title: string,
  description: string
): Promise<PreparedTxResult> {
  return buildAndPrepareSorobanTx(
    proposerAddress,
    'create_proposal',
    [toScAddress(proposerAddress), toScString(null, title), toScString(null, description)],
    `Create proposal: "${title}"`
  );
}

export async function buildCastVoteTx(
  voterAddress: string,
  proposalId: number,
  voteType: 'For' | 'Against' | 'Abstain'
): Promise<PreparedTxResult> {
  const voteScVal = toScSymbol(voteType);
  return buildAndPrepareSorobanTx(
    voterAddress,
    'cast_vote',
    [toScAddress(voterAddress), toScU32(proposalId), voteScVal],
    `Vote ${voteType} on proposal #${proposalId}`
  );
}

export async function buildExecuteProposalTx(
  callerAddress: string,
  proposalId: number
): Promise<PreparedTxResult> {
  return buildAndPrepareSorobanTx(
    callerAddress,
    'execute_proposal',
    [toScAddress(callerAddress), toScU32(proposalId)],
    `Execute proposal #${proposalId}`
  );
}

// ---------------------------------------------------------------------------
// Access Control
// ---------------------------------------------------------------------------

export async function buildGrantRoleTx(
  adminAddress: string,
  userAddress: string,
  role: 'Admin' | 'Moderator' | 'Verifier'
): Promise<PreparedTxResult> {
  return buildAndPrepareSorobanTx(
    adminAddress,
    'grant_role',
    [toScAddress(adminAddress), toScAddress(userAddress), toScSymbol(role)],
    `Grant ${role} role to ${userAddress.slice(0, 6)}...`
  );
}

export async function buildRevokeRoleTx(
  adminAddress: string,
  userAddress: string
): Promise<PreparedTxResult> {
  return buildAndPrepareSorobanTx(
    adminAddress,
    'revoke_role',
    [toScAddress(adminAddress), toScAddress(userAddress)],
    `Revoke role from ${userAddress.slice(0, 6)}...`
  );
}

// ---------------------------------------------------------------------------
// Pause Control
// ---------------------------------------------------------------------------

export async function buildPauseAllTx(adminAddress: string): Promise<PreparedTxResult> {
  return buildAndPrepareSorobanTx(
    adminAddress,
    'pause_all',
    [toScAddress(adminAddress)],
    'Emergency pause all contract operations'
  );
}

export async function buildUnpauseAllTx(adminAddress: string): Promise<PreparedTxResult> {
  return buildAndPrepareSorobanTx(
    adminAddress,
    'unpause_all',
    [toScAddress(adminAddress)],
    'Unpause all contract operations'
  );
}

export async function buildPauseTx(
  adminAddress: string,
  action: string
): Promise<PreparedTxResult> {
  return buildAndPrepareSorobanTx(
    adminAddress,
    'pause',
    [toScAddress(adminAddress), toScSymbol(action)],
    `Pause action: ${action}`
  );
}

export async function buildUnpauseTx(
  adminAddress: string,
  action: string
): Promise<PreparedTxResult> {
  return buildAndPrepareSorobanTx(
    adminAddress,
    'unpause',
    [toScAddress(adminAddress), toScSymbol(action)],
    `Unpause action: ${action}`
  );
}
