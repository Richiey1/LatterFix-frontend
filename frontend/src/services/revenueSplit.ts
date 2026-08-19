/* eslint-disable
  @typescript-eslint/no-unsafe-assignment,
  @typescript-eslint/no-base-to-string
*/
import {
  Address,
  BASE_FEE,
  Contract,
  Networks,
  rpc,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000';
const DEFAULT_RPC_URL =
  (import.meta.env.PUBLIC_STELLAR_RPC_URL as string | undefined) ||
  'https://soroban-testnet.stellar.org';

export const TOTAL_BASIS_POINTS = 10000;

export interface RevenueAllocation {
  recipient: string;
  percentage: number;
}

export interface DistributionEvent {
  id: number;
  createdAt: string;
  txHash: string | null;
  amount: number;
  assetCode: string;
  action: string;
  recipientLabel: string;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function getNetworkPassphrase(): string {
  const network = (import.meta.env.PUBLIC_STELLAR_NETWORK as string | undefined)?.toUpperCase();
  return network === 'MAINNET' ? Networks.PUBLIC : Networks.TESTNET;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Converts allocation percentages (0-100, may carry decimals) into whole
 * basis points (0-10000) whose sum is always exactly TOTAL_BASIS_POINTS.
 * Any rounding residual is absorbed by the last entry, mirroring the
 * contract's own remainder-absorption convention in `distribute`.
 */
export function percentagesToBasisPoints(percentages: number[]): number[] {
  if (percentages.length === 0) return [];

  const rounded = percentages.map((p) => Math.round(p * 100));
  const sum = rounded.reduce((total, value) => total + value, 0);
  const remainder = TOTAL_BASIS_POINTS - sum;

  const result = [...rounded];
  result[result.length - 1] += remainder;

  if (result.some((bp) => bp < 0)) {
    throw new Error(
      'Could not convert allocation percentages to whole basis points without a negative share. Adjust percentages so the total is closer to 100%.'
    );
  }

  return result;
}

function normalizeAllocationsFromNative(nativeValue: unknown): RevenueAllocation[] {
  if (!Array.isArray(nativeValue)) return [];

  return nativeValue
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return { recipient: '', percentage: 0 };
      const item = entry as Record<string, unknown>;
      return {
        recipient: String(item.destination ?? ''),
        percentage: toNumber(item.basis_points) / 100,
      };
    })
    .filter((entry) => entry.recipient);
}

/**
 * Encodes one RecipientShare struct as an ScMap. Soroban's #[contracttype]
 * derive serializes named struct fields sorted alphabetically by field name
 * (and requires ScMap entries to be key-sorted to be valid on-chain), so for
 * `RecipientShare { destination, basis_points }` the `basis_points` entry
 * must come before `destination` (b < d).
 */
function recipientShareToScVal(destination: string, basisPoints: number): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('basis_points'),
      val: nativeToScVal(basisPoints, { type: 'u32' }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('destination'),
      val: nativeToScVal(Address.fromString(destination), { type: 'address' }),
    }),
  ]);
}

/** Builds the Vec<RecipientShare> ScVal argument for `update_recipients`. */
export function buildRecipientShareVecScVal(allocations: RevenueAllocation[]): xdr.ScVal {
  const basisPoints = percentagesToBasisPoints(allocations.map((entry) => entry.percentage));
  return xdr.ScVal.scvVec(
    allocations.map((allocation, index) =>
      recipientShareToScVal(allocation.recipient, basisPoints[index])
    )
  );
}

export async function fetchRevenueSplitAllocations(
  contractId: string,
  sourceAddress: string,
  rpcUrlOverride?: string
): Promise<RevenueAllocation[]> {
  const rpcUrl = normalizeBaseUrl(rpcUrlOverride || DEFAULT_RPC_URL);
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const account = await server.getAccount(sourceAddress);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call('get_recipients'))
    .setTimeout(60)
    .build();

  const rpcResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'simulateTransaction',
      params: { transaction: tx.toXDR() },
    }),
  });

  if (!rpcResponse.ok) {
    throw new Error(`Failed to simulate allocation read (${rpcResponse.status})`);
  }

  const payload = (await rpcResponse.json()) as {
    result?: { retval?: string; error?: string };
    error?: { message?: string };
  };

  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }

  if (!payload.result?.retval) {
    return [];
  }

  const retval = xdr.ScVal.fromXDR(payload.result.retval, 'base64');
  const nativeValue = scValToNative(retval);
  return normalizeAllocationsFromNative(nativeValue);
}

export async function fetchDistributionEvents(
  organizationId: number,
  page = 1,
  limit = 30
): Promise<DistributionEvent[]> {
  const response = await fetch(
    `${normalizeBaseUrl(API_BASE_URL)}/api/v1/payroll/audit?organizationId=${organizationId}&page=${page}&limit=${limit}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch distribution events (${response.status})`);
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: Array<Record<string, unknown>>;
  };

  return (payload.data || []).map((event) => ({
    id: Number(event.id ?? 0),
    createdAt: String(event.created_at ?? ''),
    txHash: (event.tx_hash as string | null) ?? null,
    amount: toNumber(event.amount),
    assetCode: String(event.asset_code ?? 'USDC'),
    action: String(event.action ?? 'unknown'),
    recipientLabel:
      `${String(event.employee_first_name ?? '')} ${String(event.employee_last_name ?? '')}`.trim() ||
      String(event.employee_email ?? 'Unknown recipient'),
  }));
}
