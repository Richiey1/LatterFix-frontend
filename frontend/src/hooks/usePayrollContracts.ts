import { Address, nativeToScVal, scValToNative, xdr } from '@stellar/stellar-sdk';
import type { ContractType } from '../services/contracts.types';
import { useSorobanContract } from './useSorobanContract';

export interface BulkPaymentResult {
  totalRecipients: number;
  successfulPayments: number;
  failedPayments: number;
  transactionHash: string;
}

export interface VestingGrantResult {
  beneficiary: string;
  token: string;
  startTime: number;
  cliffSeconds: number;
  durationSeconds: number;
  totalAmount: string;
  claimedAmount: string;
  clawbackAdmin: string;
  isActive: boolean;
}

export interface RevenueSplitResult {
  roundId: string;
  totalDistributed: string;
  participantCount: number;
  transactionHash: string;
}

function parseBulkPaymentResult(raw: unknown): BulkPaymentResult {
  const data = raw as Record<string, unknown>;
  return {
    totalRecipients: typeof data?.totalRecipients === 'number' ? data.totalRecipients : 0,
    successfulPayments: typeof data?.successfulPayments === 'number' ? data.successfulPayments : 0,
    failedPayments: typeof data?.failedPayments === 'number' ? data.failedPayments : 0,
    transactionHash: typeof data?.transactionHash === 'string' ? data.transactionHash : '',
  };
}

function toStringValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (typeof value === 'object' && value instanceof Address) return value.toString();
  if (value && typeof value === 'object' && 'toString' in value) {
    return String((value as { toString: () => string }).toString());
  }
  return '';
}

function toNumberValue(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toBigIntString(value: unknown): string {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return String(Math.trunc(value));
  if (typeof value === 'string' && value.trim()) return value;
  return '0';
}

function parseVestingGrantResult(raw: unknown): VestingGrantResult {
  const data = (raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;

  return {
    beneficiary: toStringValue(data.beneficiary ?? data.beneficiary_address),
    token: toStringValue(data.token),
    startTime: toNumberValue(data.start_time ?? data.startTime),
    cliffSeconds: toNumberValue(data.cliff_seconds ?? data.cliffSeconds),
    durationSeconds: toNumberValue(data.duration_seconds ?? data.durationSeconds),
    totalAmount: toBigIntString(data.total_amount ?? data.totalAmount),
    claimedAmount: toBigIntString(data.claimed_amount ?? data.claimedAmount),
    clawbackAdmin: toStringValue(data.clawback_admin ?? data.clawbackAdmin),
    isActive: data.is_active === true || data.isActive === true,
  };
}

function parseRevenueSplitResult(raw: unknown): RevenueSplitResult {
  const data = raw as Record<string, unknown>;
  return {
    roundId: typeof data?.roundId === 'string' ? data.roundId : '',
    totalDistributed: typeof data?.totalDistributed === 'string' ? data.totalDistributed : '0',
    participantCount: typeof data?.participantCount === 'number' ? data.participantCount : 0,
    transactionHash: typeof data?.transactionHash === 'string' ? data.transactionHash : '',
  };
}

export function useBulkPaymentContract(contractId: string) {
  const hook = useSorobanContract<BulkPaymentResult>(contractId);

  const distribute = async (args: { recipients: string[]; amounts: string[]; asset?: string }) => {
    return hook.invoke({
      method: 'distribute',
      args: [
        nativeToScVal(args.recipients),
        nativeToScVal(args.amounts),
        args.asset ? nativeToScVal(args.asset) : null,
      ],
      parseResult: parseBulkPaymentResult,
    });
  };

  const getPaymentStatus = async (paymentId: string) => {
    return hook.invoke({
      method: 'get_payment_status',
      args: [paymentId],
      parseResult: (raw: unknown) => scValToNative(raw as xdr.ScVal) as BulkPaymentResult,
    });
  };

  return { ...hook, distribute, getPaymentStatus };
}

export function useVestingEscrowContract(contractId: string) {
  const hook = useSorobanContract<unknown>(contractId);

  const createGrant = async (args: {
    funder: string;
    beneficiary: string;
    token: string;
    startTime: number;
    cliffSeconds: number;
    durationSeconds: number;
    amount: string;
    clawbackAdmin?: string;
  }) => {
    return hook.invoke({
      method: 'initialize',
      args: [
        new Address(args.funder),
        new Address(args.beneficiary),
        new Address(args.token),
        BigInt(args.startTime),
        BigInt(args.cliffSeconds),
        BigInt(args.durationSeconds),
        BigInt(args.amount),
        new Address(args.clawbackAdmin ?? args.funder),
      ],
      parseResult: () => null,
    });
  };

  const claim = async () => {
    return hook.invoke({
      method: 'claim',
      args: [],
      parseResult: () => null,
    });
  };

  const getGrant = async () => {
    return hook.invoke({
      method: 'get_config',
      args: [],
      parseResult: parseVestingGrantResult,
    });
  };

  const getVestedAmount = async () => {
    return hook.invoke({
      method: 'get_vested_amount',
      args: [],
      parseResult: toBigIntString,
    });
  };

  const getClaimableAmount = async () => {
    return hook.invoke({
      method: 'get_claimable_amount',
      args: [],
      parseResult: toBigIntString,
    });
  };

  return { ...hook, createGrant, claim, getGrant, getVestedAmount, getClaimableAmount };
}

export function useRevenueSplitContract(contractId: string) {
  const hook = useSorobanContract<RevenueSplitResult>(contractId);

  const createRound = async (args: {
    totalPrize: string;
    participants: string[];
    weights?: number[];
  }) => {
    return hook.invoke({
      method: 'create_round',
      args: [args.totalPrize, nativeToScVal(args.participants), nativeToScVal(args.weights ?? [])],
      parseResult: parseRevenueSplitResult,
    });
  };

  const distribute = async (roundId: string) => {
    return hook.invoke({
      method: 'distribute',
      args: [roundId],
      parseResult: parseRevenueSplitResult,
    });
  };

  const getRoundStatus = async (roundId: string) => {
    return hook.invoke({
      method: 'get_round_status',
      args: [roundId],
      parseResult: (raw: unknown) => scValToNative(raw as xdr.ScVal) as RevenueSplitResult,
    });
  };

  return { ...hook, createRound, distribute, getRoundStatus };
}

export function getContractHook(contractType: ContractType) {
  switch (contractType) {
    case 'bulk_payment':
      return useBulkPaymentContract;
    case 'vesting_escrow':
      return useVestingEscrowContract;
    case 'revenue_split':
      return useRevenueSplitContract;
    default:
      return useSorobanContract;
  }
}
