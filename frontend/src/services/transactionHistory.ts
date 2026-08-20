/**
 * Horizon Transaction History Service
 *
 * Fetches real on-chain transaction history for a Stellar account directly
 * from the Horizon REST API. Supports:
 *   - Loading paginated transaction records for a given account
 *   - Loading operation details for each transaction
 *   - Fetching claimable balances for a specific account
 *   - Parsing Soroban contract invocation events
 *   - Fetching contract events from the Soroban RPC events endpoint
 *
 * No backend required — all data comes from Horizon / Soroban RPC directly.
 */

import { Horizon, Networks } from '@stellar/stellar-sdk';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function getHorizonUrl(): string {
  const envUrl = import.meta.env.PUBLIC_STELLAR_HORIZON_URL as string | undefined;
  return (envUrl ?? 'https://horizon-testnet.stellar.org').replace(/\/+$/, '');
}

function getRpcUrl(): string {
  const envRpc = import.meta.env.PUBLIC_STELLAR_RPC_URL as string | undefined;
  return (envRpc ?? 'https://soroban-testnet.stellar.org').replace(/\/+$/, '');
}

function getNetworkPassphrase(): string {
  const net = (import.meta.env.PUBLIC_STELLAR_NETWORK as string | undefined)?.toUpperCase();
  return net === 'MAINNET' ? Networks.PUBLIC : Networks.TESTNET;
}

export function getExplorerTxUrl(txHash: string): string {
  const net = getNetworkPassphrase() === Networks.PUBLIC ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${net}/tx/${txHash}`;
}

export function getExplorerAccountUrl(address: string): string {
  const net = getNetworkPassphrase() === Networks.PUBLIC ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${net}/account/${address}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TxKind =
  | 'payment'
  | 'claimable_balance'
  | 'soroban_invoke'
  | 'change_trust'
  | 'path_payment'
  | 'other';

export interface HorizonTransaction {
  id: string;
  hash: string;
  createdAt: string;
  ledger: number;
  memo?: string;
  feeCharged: string;
  successful: boolean;
  sourceAccount: string;
  operationCount: number;
  kind: TxKind;
  /** Decoded top-level label for display */
  label: string;
  explorerUrl: string;
}

export interface HorizonOperation {
  id: string;
  type: string;
  sourceAccount: string;
  /** Payment, path payment */
  amount?: string;
  asset?: string;
  /** Payment destination */
  to?: string;
  /** Path payment intermediaries */
  path?: string[];
}

export interface ClaimableBalanceRecord {
  id: string;
  asset: string;
  amount: string;
  sponsor?: string;
  claimants: { destination: string; predicate: object }[];
  lastModifiedLedger: number;
}

export interface SorobanContractEvent {
  id: string;
  type: string;
  ledger: number;
  ledgerClosedAt: string;
  contractId: string;
  /** Decoded topic array */
  topics: string[];
  /** Decoded event value */
  value: string;
  txHash: string;
}

// ---------------------------------------------------------------------------
// Transaction History
// ---------------------------------------------------------------------------

/**
 * Fetches paginated transaction records for a Stellar account from Horizon.
 */
export async function fetchAccountTransactions(
  accountId: string,
  limit = 15,
  cursor?: string
): Promise<{ transactions: HorizonTransaction[]; nextCursor: string | null }> {
  const server = new Horizon.Server(getHorizonUrl());

  let builder = server.transactions().forAccount(accountId).order('desc').limit(limit);

  if (cursor) {
    builder = builder.cursor(cursor);
  }

  const response = await builder.call();

  const transactions: HorizonTransaction[] = response.records.map((tx) => {
    const kind = inferTxKind(tx);
    return {
      id: tx.id,
      hash: tx.hash,
      createdAt: tx.created_at,
      ledger: (tx as any).ledger_attr ?? 0,
      memo: tx.memo_type !== 'none' ? String(tx.memo ?? '') : undefined,
      feeCharged: String(tx.fee_charged),
      successful: tx.successful,
      sourceAccount: tx.source_account,
      operationCount: tx.operation_count,
      kind,
      label: labelForKind(kind),
      explorerUrl: getExplorerTxUrl(tx.hash),
    };
  });

  const lastRecord = response.records[response.records.length - 1];
  const nextCursor =
    lastRecord && response.records.length === limit ? lastRecord.paging_token : null;

  return { transactions, nextCursor };
}

function inferTxKind(tx: any): TxKind {
  // Heuristic: Soroban txs have nonzero soroban fee
  if ('fee_account' in tx && tx.operation_count === 1) {
    // Could check tx.fee_bump_transaction presence or other signals
    // Simple heuristic: if memo contains 'LatterFix', likely Soroban
    if (typeof tx.memo === 'string' && tx.memo.includes('LatterFix')) {
      return 'soroban_invoke';
    }
  }
  // Look at number of operations and type as rough heuristic
  if (tx.operation_count === 1) return 'payment';
  return 'other';
}

function labelForKind(kind: TxKind): string {
  const map: Record<TxKind, string> = {
    payment: 'Payment',
    claimable_balance: 'Claimable Balance',
    soroban_invoke: 'Soroban Contract Call',
    change_trust: 'Trustline Change',
    path_payment: 'Path Payment',
    other: 'Transaction',
  };
  return map[kind];
}

// ---------------------------------------------------------------------------
// Operation Details
// ---------------------------------------------------------------------------

/**
 * Fetches operation details for a specific transaction hash.
 */
export async function fetchTransactionOperations(txHash: string): Promise<HorizonOperation[]> {
  const server = new Horizon.Server(getHorizonUrl());
  const ops = await server.operations().forTransaction(txHash).limit(20).call();

  return ops.records.map((op): HorizonOperation => {
    const base = { id: op.id, type: op.type, sourceAccount: op.source_account };

    if (op.type === 'payment') {
      const p = op as any;
      return {
        ...base,
        amount: p.amount,
        asset: p.asset_type === 'native' ? 'XLM' : `${p.asset_code}:${p.asset_issuer}`,
        to: p.to,
      };
    }

    if (op.type === 'path_payment_strict_send' || op.type === 'path_payment_strict_receive') {
      const pp = op as any;
      return {
        ...base,
        amount: pp.amount,
        asset: pp.asset_type === 'native' ? 'XLM' : `${pp.asset_code}:${pp.asset_issuer}`,
        to: pp.to,
      };
    }

    return base;
  });
}

// ---------------------------------------------------------------------------
// Claimable Balances
// ---------------------------------------------------------------------------

/**
 * Fetches all claimable balances where the given address is a claimant.
 * These represent payments locked for this user to claim.
 */
export async function fetchClaimableBalancesForClaimant(
  claimantAddress: string,
  limit = 20
): Promise<ClaimableBalanceRecord[]> {
  const server = new Horizon.Server(getHorizonUrl());

  const response = await server
    .claimableBalances()
    .claimant(claimantAddress)
    .order('desc')
    .limit(limit)
    .call();

  return response.records.map((cb) => ({
    id: cb.id,
    asset: cb.asset,
    amount: cb.amount,
    sponsor: cb.sponsor,
    claimants: cb.claimants,
    lastModifiedLedger: cb.last_modified_ledger,
  }));
}

/**
 * Fetches all claimable balances sponsored by a given address.
 * These represent payments the user has locked for others.
 */
export async function fetchClaimableBalancesBySponsor(
  sponsorAddress: string,
  limit = 20
): Promise<ClaimableBalanceRecord[]> {
  const server = new Horizon.Server(getHorizonUrl());

  const response = await server
    .claimableBalances()
    .sponsor(sponsorAddress)
    .order('desc')
    .limit(limit)
    .call();

  return response.records.map((cb) => ({
    id: cb.id,
    asset: cb.asset,
    amount: cb.amount,
    sponsor: cb.sponsor,
    claimants: cb.claimants,
    lastModifiedLedger: cb.last_modified_ledger,
  }));
}

// ---------------------------------------------------------------------------
// Soroban Contract Events
// ---------------------------------------------------------------------------

interface RpcEventEntry {
  type: string;
  ledger: number;
  ledgerClosedAt: string;
  contractId: string;
  id: string;
  pagingToken: string;
  topic: string[];
  value: string;
  inSuccessfulContractCall: boolean;
  txHash: string;
}

interface RpcEventsResponse {
  result?: {
    events: RpcEventEntry[];
    latestLedger: number;
  };
  error?: { message: string; code: number };
}

/**
 * Fetches contract events emitted by the LatterFix Soroban contract
 * using the Soroban RPC `getEvents` method.
 *
 * Covers: TaskCreated, TaskAssigned, TaskCompleted, DisputeRaised, etc.
 */
export async function fetchContractEvents(
  contractId: string,
  startLedger: number,
  limit = 20
): Promise<SorobanContractEvent[]> {
  const rpcUrl = getRpcUrl();

  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'getEvents',
    params: {
      startLedger,
      filters: [
        {
          type: 'contract',
          contractIds: [contractId],
        },
      ],
      pagination: { limit },
    },
  });

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!response.ok) {
    throw new Error(`Soroban RPC getEvents failed: ${response.status}`);
  }

  const data = (await response.json()) as RpcEventsResponse;

  if (data.error) {
    throw new Error(`RPC error ${data.error.code}: ${data.error.message}`);
  }

  return (data.result?.events ?? []).map(
    (e): SorobanContractEvent => ({
      id: e.id,
      type: e.type,
      ledger: e.ledger,
      ledgerClosedAt: e.ledgerClosedAt,
      contractId: e.contractId,
      topics: e.topic,
      value: e.value,
      txHash: e.txHash,
    })
  );
}

// ---------------------------------------------------------------------------
// Fee Stats
// ---------------------------------------------------------------------------

export interface NetworkFeeStats {
  baseFee: number;
  p50Fee: number;
  p99Fee: number;
  congestion: 'low' | 'moderate' | 'high';
  lastLedger: number;
}

/**
 * Fetches live fee statistics from Horizon to show current network congestion.
 */
export async function fetchNetworkFeeStats(): Promise<NetworkFeeStats> {
  const url = `${getHorizonUrl()}/fee_stats`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fee_stats failed: ${res.status}`);
  const data = (await res.json()) as {
    last_ledger: string;
    last_ledger_base_fee: string;
    ledger_capacity_usage: string;
    fee_charged: { p50: string; p99: string };
  };

  const usage = parseFloat(data.ledger_capacity_usage);
  const congestion: 'low' | 'moderate' | 'high' =
    usage < 0.25 ? 'low' : usage < 0.75 ? 'moderate' : 'high';

  return {
    baseFee: Number(data.last_ledger_base_fee),
    p50Fee: Number(data.fee_charged.p50),
    p99Fee: Number(data.fee_charged.p99),
    congestion,
    lastLedger: Number(data.last_ledger),
  };
}
