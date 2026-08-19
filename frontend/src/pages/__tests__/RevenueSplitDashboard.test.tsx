import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import RevenueSplitDashboard from '../RevenueSplitDashboard';

const mocks = vi.hoisted(() => ({
  role: 'Admin' as 'Creator' | 'Contributor' | 'Admin',
  address: 'GABCDEXAMPLEADDRESS0000000000000000000000000000000000000' as string | null,
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
  invoke: vi.fn<() => Promise<{ txHash: string }>>(),
  fetchRevenueSplitAllocations: vi.fn(),
  fetchDistributionEvents: vi.fn(),
  buildRecipientShareVecScVal: vi.fn(() => ({ __scVal: true })),
}));

vi.mock('../../hooks/useWallet', () => ({
  useWallet: () => ({
    address: mocks.address,
    connect: vi.fn(),
    requireWallet: vi.fn().mockResolvedValue(mocks.address),
  }),
}));

vi.mock('../../hooks/useNotification', () => ({
  useNotification: () => ({
    notifyError: mocks.notifyError,
    notifySuccess: mocks.notifySuccess,
  }),
}));

vi.mock('../../hooks/useSorobanContract', () => ({
  useSorobanContract: () => ({
    invoke: mocks.invoke,
    loading: false,
    error: null,
    result: null,
  }),
}));

vi.mock('../../services/taskStore', () => ({
  useTaskStore: () => ({ currentUser: { role: mocks.role } }),
}));

vi.mock('../../services/contracts', () => ({
  contractService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getContractId: vi.fn(() => 'CCONTRACTPLACEHOLDER00000000000000000000000000000000000'),
  },
}));

vi.mock('../../services/revenueSplit', () => ({
  fetchRevenueSplitAllocations: mocks.fetchRevenueSplitAllocations,
  fetchDistributionEvents: mocks.fetchDistributionEvents,
  buildRecipientShareVecScVal: mocks.buildRecipientShareVecScVal,
}));

describe('RevenueSplitDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.role = 'Admin';
    mocks.address = 'GABCDEXAMPLEADDRESS0000000000000000000000000000000000000';
    mocks.fetchRevenueSplitAllocations.mockResolvedValue([
      { recipient: 'GRECIPIENT1000000000000000000000000000000000000000000000', percentage: 60 },
      { recipient: 'GRECIPIENT2000000000000000000000000000000000000000000000', percentage: 40 },
    ]);
    mocks.fetchDistributionEvents.mockResolvedValue([]);
    mocks.invoke.mockResolvedValue({ txHash: 'txhash123' });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the edit form for an Admin', async () => {
    render(<RevenueSplitDashboard />);

    expect(await screen.findByText('Edit Allocations')).toBeTruthy();
    expect(screen.queryByText(/Admin access required/i)).toBeNull();
  });

  it('hides the edit form and shows a read-only notice for a non-Admin', async () => {
    mocks.role = 'Contributor';
    render(<RevenueSplitDashboard />);

    expect(
      await screen.findByText('Admin access required to edit revenue split allocations.')
    ).toBeTruthy();
    expect(screen.queryByText('Edit Allocations')).toBeNull();
  });

  it('blocks submission and never invokes the contract when the allocation total is not 100%', async () => {
    mocks.fetchRevenueSplitAllocations.mockResolvedValue([
      { recipient: 'GRECIPIENT1000000000000000000000000000000000000000000000', percentage: 60 },
      { recipient: 'GRECIPIENT2000000000000000000000000000000000000000000000', percentage: 30 },
    ]);
    render(<RevenueSplitDashboard />);

    const submitButton = await screen.findByRole('button', { name: /submit on-chain update/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.notifyError).toHaveBeenCalledWith(
        'Invalid allocation total',
        expect.stringContaining('90.00%')
      );
    });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('submits an on-chain update_recipients call when the total is exactly 100%', async () => {
    render(<RevenueSplitDashboard />);

    const submitButton = await screen.findByRole('button', { name: /submit on-chain update/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith({
        method: 'update_recipients',
        args: [{ __scVal: true }],
      });
    });
    expect(mocks.notifySuccess).toHaveBeenCalledWith(
      'Allocations updated',
      expect.stringContaining('txhash123')
    );
  });
});
