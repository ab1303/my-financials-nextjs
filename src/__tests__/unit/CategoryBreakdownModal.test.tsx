import { describe, expect, it } from 'vitest';

import { buildCategoryTransactionHref } from '@/app/(authorized)/cashflow/expense/_components/category-transaction-link';

describe('CategoryBreakdownModal drill-down link', () => {
  it('generates the expected transactions URL', () => {
    expect(buildCategoryTransactionHref('Groceries', 2, 2025)).toBe(
      '/cashflow/transactions?category=groceries&month=2&year=2025',
    );
  });
});
