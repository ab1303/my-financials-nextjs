import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { UnlinkTransferButton } from '@/components/transactions/UnlinkTransferButton';

const mockMutate = vi.fn();
let mockIsPending = false;
let onSuccessCallback: (() => void) | null = null;
let onErrorCallback: ((err: { message?: string }) => void) | null = null;

vi.mock('@/server/trpc/client', () => ({
  trpc: {
    transfer: {
      unlink: {
        useMutation: vi.fn((opts: { onSuccess: () => void; onError: (err: { message?: string }) => void }) => {
          onSuccessCallback = opts.onSuccess;
          onErrorCallback = opts.onError;
          return { mutate: mockMutate, isPending: mockIsPending };
        }),
      },
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('UnlinkTransferButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutate.mockReset();
    onSuccessCallback = null;
    onErrorCallback = null;
    mockIsPending = false;
  });

  it('renders unlink button', () => {
    render(<UnlinkTransferButton transactionId="tx-1" onUnlinked={vi.fn()} />);
    expect(screen.getByRole('button', { name: /unlink transfer/i })).toBeDefined();
  });

  it('calls mutate on click', () => {
    render(<UnlinkTransferButton transactionId="tx-1" onUnlinked={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /unlink transfer/i }));
    expect(mockMutate).toHaveBeenCalledWith({ transactionId: 'tx-1' });
  });

  it('is disabled when pending', () => {
    mockIsPending = true;
    render(<UnlinkTransferButton transactionId="tx-1" onUnlinked={vi.fn()} />);
    expect(screen.getByRole('button', { name: /unlink transfer/i })).toBeDisabled();
  });

  it('calls onUnlinked on success', () => {
    const onUnlinked = vi.fn();
    render(<UnlinkTransferButton transactionId="tx-1" onUnlinked={onUnlinked} />);
    onSuccessCallback?.();
    expect(onUnlinked).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith('Transfer unlinked');
  });

  it('shows toast error on error callback', () => {
    render(<UnlinkTransferButton transactionId="tx-1" onUnlinked={vi.fn()} />);
    onErrorCallback?.({ message: 'custom error' });
    expect(toast.error).toHaveBeenCalledWith('custom error');
  });
});
