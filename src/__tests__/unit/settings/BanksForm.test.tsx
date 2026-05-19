'use client';

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BanksForm from '@/app/(authorized)/settings/banks/form';

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Setup trpc mocks
const mocks = vi.hoisted(() => ({
  getAllBanksState: {
    data: [] as Array<{ id: string; name: string }>,
    isLoading: false as boolean,
    isPending: false,
  },
  saveBankMutation: {
    mutate: vi.fn(),
    isPending: false,
  },
  deleteBankMutation: {
    mutate: vi.fn(),
    isPending: false,
  },
  refetchQueriesFn: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    refetchQueries: mocks.refetchQueriesFn,
  }),
}));

vi.mock('@/server/trpc/client', () => ({
  trpc: {
    bank: {
      getAllBanks: {
        useQuery: vi.fn(() => mocks.getAllBanksState),
      },
      saveBankDetails: {
        useMutation: vi.fn((config: any) => ({
          mutate: vi.fn((input: { name: string }) => {
            if (config.onSuccess) config.onSuccess();
          }),
          isPending: mocks.saveBankMutation.isPending,
        })),
      },
      removeBankDetails: {
        useMutation: vi.fn((config: any) => ({
          mutate: vi.fn((input: { bankId: string }) => {
            if (config.onSuccess) config.onSuccess();
          }),
          isPending: mocks.deleteBankMutation.isPending,
        })),
      },
    },
  },
}));

describe('BanksForm - Phase 1 UI Redesign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllBanksState.data = [];
    mocks.getAllBanksState.isLoading = false;
  });

  it('should render only the bank name input field', () => {
    render(<BanksForm />);
    const nameInput = screen.getByPlaceholderText(/Commonwealth Bank/i);
    expect(nameInput).toBeInTheDocument();
  });

  it('should not render address fields', () => {
    render(<BanksForm />);
    expect(screen.queryByPlaceholderText(/address/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/suburb/i)).not.toBeInTheDocument();
  });

  it('should add bank when Enter key is pressed', async () => {
    const user = userEvent.setup();
    render(<BanksForm />);
    const input = screen.getByPlaceholderText(/Commonwealth Bank/i);
    await user.type(input, 'Test Bank');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('button', { name: /Add/i })).toBeInTheDocument();
  });

  it('should add bank when Add button is clicked', async () => {
    const user = userEvent.setup();
    render(<BanksForm />);
    const input = screen.getByPlaceholderText(/Commonwealth Bank/i);
    const addButton = screen.getByRole('button', { name: /Add/i });
    await user.type(input, 'Westpac');
    await user.click(addButton);
    expect(addButton).toBeInTheDocument();
  });

  it('should disable Add button when input is empty', () => {
    render(<BanksForm />);
    const addButton = screen.getByRole('button', { name: /Add/i });
    expect(addButton).toBeDisabled();
  });

  it('should display banks in table format', () => {
    mocks.getAllBanksState.data = [
      { id: '1', name: 'Commonwealth Bank' },
    ];
    render(<BanksForm />);
    expect(screen.getByText('Commonwealth Bank')).toBeInTheDocument();
    expect(screen.getByText('Institution')).toBeInTheDocument();
  });

  it('should display loading state', () => {
    mocks.getAllBanksState.isLoading = true;
    render(<BanksForm />);
    expect(screen.getByText(/Loading institutions/i)).toBeInTheDocument();
  });

  it('should display empty state message', () => {
    mocks.getAllBanksState.data = [];
    mocks.getAllBanksState.isLoading = false;
    render(<BanksForm />);
    expect(screen.getByText('No bank institutions yet')).toBeInTheDocument();
  });

  it('should have delete button for each bank', () => {
    mocks.getAllBanksState.data = [
      { id: '1', name: 'Commonwealth Bank' },
    ];
    render(<BanksForm />);
    expect(screen.getByRole('button', { name: /Remove/i })).toBeInTheDocument();
  });
});
