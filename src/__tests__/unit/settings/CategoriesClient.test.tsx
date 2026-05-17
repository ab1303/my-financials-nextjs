import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CategoriesClient from '@/app/(authorized)/settings/categories/_components/CategoriesClient';
import IncomeSources from '@/app/(authorized)/settings/categories/_components/IncomeSources';

const mocks = vi.hoisted(() => ({
  incomeQueryState: { data: [], isLoading: false as boolean },
  expenseQueryState: { data: [], isLoading: false as boolean },
  invalidateMock: vi.fn(),
  useMutationMock: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('@/server/trpc/client', () => ({
  trpc: {
    useUtils: () => ({
      incomeSource: { getAll: { invalidate: mocks.invalidateMock } },
      expenseCategory: { getAll: { invalidate: mocks.invalidateMock } },
    }),
    incomeSource: {
      getAll: {
        useQuery: vi.fn(() => mocks.incomeQueryState),
      },
      getAllActive: {
        useQuery: vi.fn(() => ({ data: [] })),
      },
      create: {
        useMutation: mocks.useMutationMock,
      },
      update: {
        useMutation: mocks.useMutationMock,
      },
      restore: {
        useMutation: mocks.useMutationMock,
      },
      remove: {
        useMutation: mocks.useMutationMock,
      },
    },
    expenseCategory: {
      getAll: {
        useQuery: vi.fn(() => mocks.expenseQueryState),
      },
      getAllActive: {
        useQuery: vi.fn(() => ({ data: [] })),
      },
      create: {
        useMutation: mocks.useMutationMock,
      },
      update: {
        useMutation: mocks.useMutationMock,
      },
      restore: {
        useMutation: mocks.useMutationMock,
      },
      remove: {
        useMutation: mocks.useMutationMock,
      },
    },
  },
}));

describe('Categories settings', () => {
  beforeEach(() => {
    mocks.incomeQueryState.data = [];
    mocks.incomeQueryState.isLoading = false;
    mocks.expenseQueryState.data = [];
    mocks.expenseQueryState.isLoading = false;
    mocks.invalidateMock.mockClear();
    mocks.useMutationMock.mockClear();
  });

  it('CategoriesClient renders Income Sources tab by default', () => {
    render(<CategoriesClient />);

    expect(screen.getByRole('button', { name: 'Income Sources' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('New income source name…')).toBeInTheDocument();
  });

  it('Clicking Expense Categories tab shows expense panel', async () => {
    const user = userEvent.setup();
    render(<CategoriesClient />);

    await user.click(screen.getByRole('button', { name: 'Expense Categories' }));

    expect(screen.getByPlaceholderText('New expense category name…')).toBeInTheDocument();
  });

  it('IncomeSources renders loading state while data is fetching', () => {
    mocks.incomeQueryState.isLoading = true;

    render(<IncomeSources />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('IncomeSources renders active sources list', () => {
    mocks.incomeQueryState.data = [
      { id: '1', name: 'Salary', isActive: true, usageCount: 4 },
      { id: '2', name: 'Freelance', isActive: true, usageCount: 1 },
    ];

    render(<IncomeSources />);

    expect(screen.getByText('Salary')).toBeInTheDocument();
    expect(screen.getByText('Freelance')).toBeInTheDocument();
  });

  it('Inactive sources show Inactive badge and Restore button', () => {
    mocks.incomeQueryState.data = [
      { id: '3', name: 'Old Source', isActive: false, usageCount: 0 },
    ];

    render(<IncomeSources />);

    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore Old Source' })).toBeInTheDocument();
  });
});

