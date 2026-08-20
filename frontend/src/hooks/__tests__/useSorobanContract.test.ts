import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, type RenderHookResult } from '@testing-library/react';
import { useSorobanContract } from '../useSorobanContract';

type Hook = ReturnType<typeof useSorobanContract>;

/**
 * `expect(act(...)).rejects.toThrow()` observes the rejection before React's
 * `act` finishes flushing the callback's internal microtasks, so mock calls
 * made inside the hook's catch block (e.g. notifyError) aren't reliably
 * visible yet. Catching the error inside the `act` callback avoids that race.
 */
async function invokeAndCaptureError(
  hook: RenderHookResult<Hook, unknown>,
  options: Parameters<Hook['invoke']>[0]
): Promise<Error> {
  let caught: unknown;
  await act(async () => {
    try {
      await hook.result.current.invoke(options);
    } catch (error) {
      caught = error;
    }
  });
  expect(caught).toBeInstanceOf(Error);
  return caught as Error;
}

const mocks = vi.hoisted(() => ({
  address: 'GABCDEXAMPLEADDRESS0000000000000000000000000000000000000' as string | null,
  sign: vi.fn<(xdr: string) => Promise<string>>(),
  notifyError: vi.fn<(message: string, description?: string) => void>(),
  simulateTransaction: vi.fn<
    (options: { envelopeXdr: string; horizonUrl?: string }) => Promise<{
      success: boolean;
      description?: string;
    }>
  >(),
  getAccount: vi.fn<(address: string) => Promise<unknown>>(),
  prepareTransaction: vi.fn<(tx: unknown) => Promise<{ toXDR: () => string }>>(),
  sendTransaction: vi.fn<(tx: unknown) => Promise<{ status: string; hash: string }>>(),
  getTransaction: vi.fn<(hash: string) => Promise<{ status: string; returnValue?: unknown }>>(),
}));

vi.mock('../useWallet', () => ({
  useWallet: () => ({ address: mocks.address }),
}));

vi.mock('../useWalletSigning', () => ({
  useWalletSigning: () => ({ sign: mocks.sign }),
}));

vi.mock('../useNotification', () => ({
  useNotification: () => ({ notifyError: mocks.notifyError }),
}));

vi.mock('../../services/transactionSimulation', () => ({
  simulateTransaction: mocks.simulateTransaction,
}));

vi.mock('@stellar/stellar-sdk', () => {
  class Contract {
    constructor(public id: string) {}
    call(method: string, ...args: unknown[]) {
      return { type: 'operation', method, args };
    }
  }

  class TransactionBuilder {
    static fromXDR = vi.fn(() => ({ __signedTx: true }));
    constructor(
      public account: unknown,
      public opts: unknown
    ) {}
    addOperation() {
      return this;
    }
    setTimeout() {
      return this;
    }
    build() {
      return { toXDR: () => 'UNSIGNED_XDR' };
    }
  }

  class Server {
    getAccount = mocks.getAccount;
    prepareTransaction = mocks.prepareTransaction;
    sendTransaction = mocks.sendTransaction;
    getTransaction = mocks.getTransaction;
  }

  return {
    BASE_FEE: '100',
    Networks: {
      TESTNET: 'Test SDF Network ; September 2015',
      PUBLIC: 'Public Global Stellar Network ; September 2015',
    },
    StrKey: { isValidContract: () => true },
    nativeToScVal: (value: unknown) => value,
    scValToNative: (value: unknown) => value,
    Contract,
    TransactionBuilder,
    rpc: {
      Server,
      Api: {
        GetTransactionStatus: { SUCCESS: 'SUCCESS', NOT_FOUND: 'NOT_FOUND', FAILED: 'FAILED' },
      },
    },
    xdr: {},
  };
});

const CONTRACT_ID = 'CCONTRACTPLACEHOLDER00000000000000000000000000000000000';

describe('useSorobanContract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.address = 'GABCDEXAMPLEADDRESS0000000000000000000000000000000000000';
    mocks.getAccount.mockResolvedValue({ accountId: () => mocks.address });
    mocks.prepareTransaction.mockResolvedValue({ toXDR: () => 'PREPARED_XDR' });
    mocks.sign.mockResolvedValue('SIGNED_XDR');
    mocks.sendTransaction.mockResolvedValue({ status: 'PENDING', hash: 'txhash123' });
    mocks.getTransaction.mockResolvedValue({ status: 'SUCCESS', returnValue: { decoded: true } });
    mocks.simulateTransaction.mockResolvedValue({ success: true, description: 'ok' });
  });

  it('simulates, signs, submits, and decodes a successful invocation', async () => {
    const { result } = renderHook(() => useSorobanContract(CONTRACT_ID));

    let invokeResult: unknown;
    await act(async () => {
      invokeResult = await result.current.invoke({ method: 'distribute' });
    });

    expect(mocks.simulateTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.sign).toHaveBeenCalledWith('PREPARED_XDR');
    expect(invokeResult).toEqual({
      txHash: 'txhash123',
      value: { decoded: true },
      raw: { decoded: true },
    });
    expect(result.current.result?.txHash).toBe('txhash123');
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('decodes the result through a custom parseResult function', async () => {
    const { result } = renderHook(() => useSorobanContract<string>(CONTRACT_ID));

    await act(async () => {
      await result.current.invoke({
        method: 'distribute',
        parseResult: (value) => `parsed:${JSON.stringify(value)}`,
      });
    });

    expect(result.current.result?.value).toBe('parsed:{"decoded":true}');
  });

  it('blocks wallet signing when pre-flight simulation fails', async () => {
    mocks.simulateTransaction.mockResolvedValue({
      success: false,
      description: 'insufficient funds',
    });
    const hook = renderHook(() => useSorobanContract(CONTRACT_ID));

    const error = await invokeAndCaptureError(hook, { method: 'distribute' });

    expect(error.message).toBe('insufficient funds');
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(mocks.sendTransaction).not.toHaveBeenCalled();
    expect(mocks.notifyError).toHaveBeenCalledWith(
      'Contract invocation failed: distribute',
      'insufficient funds'
    );
    expect(hook.result.current.error).toBe('insufficient funds');
    expect(hook.result.current.loading).toBe(false);
  });

  it('surfaces wallet rejection errors via the notification toast system', async () => {
    mocks.sign.mockRejectedValue(new Error('User declined access'));
    const hook = renderHook(() => useSorobanContract(CONTRACT_ID));

    const error = await invokeAndCaptureError(hook, { method: 'distribute' });

    expect(error.message).toBe('User declined access');
    expect(mocks.notifyError).toHaveBeenCalledWith(
      'Contract invocation failed: distribute',
      'User declined access'
    );
    expect(hook.result.current.error).toBe('User declined access');
    expect(hook.result.current.loading).toBe(false);
  });

  it('surfaces RPC submission errors via the notification toast system', async () => {
    mocks.sendTransaction.mockResolvedValue({ status: 'ERROR', hash: 'txhash123' });
    const hook = renderHook(() => useSorobanContract(CONTRACT_ID));

    const error = await invokeAndCaptureError(hook, { method: 'distribute' });

    expect(error.message).toBe('Soroban contract submission failed.');
    expect(mocks.notifyError).toHaveBeenCalledWith(
      'Contract invocation failed: distribute',
      'Soroban contract submission failed.'
    );
  });

  it('requires a connected wallet before invoking', async () => {
    mocks.address = null;
    const hook = renderHook(() => useSorobanContract(CONTRACT_ID));

    const error = await invokeAndCaptureError(hook, { method: 'distribute' });

    expect(error.message).toBe('Connect your wallet before invoking a Soroban contract.');
    expect(mocks.simulateTransaction).not.toHaveBeenCalled();
    expect(mocks.notifyError).toHaveBeenCalledWith(
      'Contract invocation failed: distribute',
      'Connect your wallet before invoking a Soroban contract.'
    );
  });
});
