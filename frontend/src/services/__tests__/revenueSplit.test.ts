import { describe, it, expect, vi, afterEach } from 'vitest';
import { StrKey, scValToNative } from '@stellar/stellar-sdk';
import {
  buildRecipientShareVecScVal,
  fetchRevenueSplitAllocations,
  percentagesToBasisPoints,
  TOTAL_BASIS_POINTS,
} from '../revenueSplit';

/**
 * Keypair construction goes through @noble/ed25519's key-derivation path,
 * which throws in this jsdom test environment (the polyfilled Buffer isn't
 * recognized as a real Uint8Array there). These tests only need syntactically
 * valid "G..." addresses, not real key material, so encode one directly via
 * StrKey (plain base32 + checksum, no ed25519 crypto involved).
 */
function testAddress(seedByte: number): string {
  return StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(seedByte) as unknown as Buffer);
}

function testContractId(seedByte: number): string {
  return StrKey.encodeContract(new Uint8Array(32).fill(seedByte) as unknown as Buffer);
}

describe('percentagesToBasisPoints', () => {
  it('converts an even split with no rounding remainder', () => {
    expect(percentagesToBasisPoints([50, 50])).toEqual([5000, 5000]);
  });

  it('absorbs the rounding remainder into the last entry', () => {
    // 33.33 + 33.33 + 33.33 = 99.99, not 100 -- the last share must absorb
    // the shortfall so the on-chain sum is always exactly 10000.
    const basisPoints = percentagesToBasisPoints([33.33, 33.33, 33.33]);
    expect(basisPoints).toEqual([3333, 3333, 3334]);
    expect(basisPoints.reduce((sum, bp) => sum + bp, 0)).toBe(TOTAL_BASIS_POINTS);
  });

  it('throws when the remainder would make a share negative', () => {
    // The first share alone already exceeds 100%, so absorbing the
    // remainder into the last entry drives it negative.
    expect(() => percentagesToBasisPoints([150, 10])).toThrow(/negative share/);
  });

  it('returns an empty array for no allocations', () => {
    expect(percentagesToBasisPoints([])).toEqual([]);
  });
});

describe('buildRecipientShareVecScVal', () => {
  it('encodes each RecipientShare with basis_points sorted before destination', () => {
    const recipientA = testAddress(1);
    const recipientB = testAddress(2);

    const scVal = buildRecipientShareVecScVal([
      { recipient: recipientA, percentage: 60 },
      { recipient: recipientB, percentage: 40 },
    ]);

    expect(scVal.switch().name).toBe('scvVec');
    const vec = scVal.vec() ?? [];
    expect(vec).toHaveLength(2);

    const firstEntry = vec[0].map() ?? [];
    expect(firstEntry).toHaveLength(2);
    expect(firstEntry[0].key().sym().toString()).toBe('basis_points');
    expect(firstEntry[1].key().sym().toString()).toBe('destination');
  });

  it('round-trips through scValToNative back into destination/basis_points shape', () => {
    const recipient = testAddress(3);
    const scVal = buildRecipientShareVecScVal([{ recipient, percentage: 100 }]);

    const native = scValToNative(scVal) as Array<{ destination: string; basis_points: number }>;
    expect(native).toEqual([{ destination: recipient, basis_points: 10000 }]);
  });
});

describe('fetchRevenueSplitAllocations', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('decodes a simulateTransaction response into recipient/percentage allocations', async () => {
    const recipient1 = testAddress(4);
    const recipient2 = testAddress(5);

    const retval = buildRecipientShareVecScVal([
      { recipient: recipient1, percentage: 70 },
      { recipient: recipient2, percentage: 30 },
    ]);

    const sourceAccount = testAddress(6);
    // rpc.Server.getAccount is stubbed directly below, so the only fetch this
    // test needs to satisfy is the raw simulateTransaction JSON-RPC POST that
    // fetchRevenueSplitAllocations makes to decode the allocations.
    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ result: { retval: retval.toXDR('base64') } }), {
          status: 200,
        })
      )
    ) as unknown as typeof fetch;

    const { rpc } = await import('@stellar/stellar-sdk');
    vi.spyOn(rpc.Server.prototype, 'getAccount').mockResolvedValue({
      accountId: () => sourceAccount,
      sequenceNumber: () => '1',
      incrementSequenceNumber: () => undefined,
    } as unknown as Awaited<ReturnType<InstanceType<typeof rpc.Server>['getAccount']>>);

    const allocations = await fetchRevenueSplitAllocations(testContractId(7), sourceAccount);

    expect(allocations).toEqual([
      { recipient: recipient1, percentage: 70 },
      { recipient: recipient2, percentage: 30 },
    ]);
  });
});
