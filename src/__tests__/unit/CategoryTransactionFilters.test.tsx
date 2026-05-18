import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const replaceMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: pushMock,
  }),
  useSearchParams: () => new URLSearchParams('category=groceries&month=2&year=2025'),
}));

import { CategoryTransactionFilters } from '@/app/(authorized)/cashflow/transactions/_components/CategoryTransactionFilters';

describe('CategoryTransactionFilters', () => {
  it('renders initial values from props', () => {
    render(
      <CategoryTransactionFilters
        allCategories={[
          { id: 'cat-1', name: 'Groceries' },
          { id: 'cat-2', name: 'Transport' },
        ]}
        initialCategory='Groceries'
        initialMonth={2}
        initialYear={2025}
      />,
    );

    expect(screen.getByLabelText(/category/i)).toHaveValue('Groceries');
    expect(screen.getByLabelText(/month/i)).toHaveValue('2');
    expect(screen.getByLabelText(/year/i)).toHaveValue('2025');
  });

  it('reset button navigates back to the base transactions route', () => {
    render(
      <CategoryTransactionFilters
        allCategories={[]}
        initialCategory='Groceries'
        initialMonth={2}
        initialYear={2025}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /reset/i }));

    expect(pushMock).toHaveBeenCalledWith('/cashflow/transactions');
  });
});
