import type { ExpenseCategory } from '@prisma/client';
import { beforeAll,describe, expect, it } from 'vitest';

import type { CsvTransaction } from '@/server/services/ai-import/_types';
import { classifyTransactions } from '@/server/services/ai-import/csv-classifier.service';

// Skip if AI_API_KEY is not set (integration tests require real API)
const shouldRun = !!process.env.AI_API_KEY;

(shouldRun ? describe : describe.skip)('csv-classifier.service (integration)', () => {
  const mockCategories: ExpenseCategory[] = [
    {
      id: '1',
      name: 'Groceries',
      description: null,
      iconName: null,
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: '2',
      name: 'Entertainment',
      description: null,
      iconName: null,
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: '3',
      name: 'Home',
      description: null,
      iconName: null,
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: '4',
      name: 'Health & Medical',
      description: null,
      iconName: null,
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: '5',
      name: 'Vehicle & Transport',
      description: null,
      iconName: null,
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: '6',
      name: 'Eating out & takeaway',
      description: null,
      iconName: null,
      isActive: true,
      createdAt: new Date(),
    },
  ];

  const australianTransactions: CsvTransaction[] = [
    {
      id: 'tx-1',
      date: '01/07/2025',
      amount: 85.5,
      type: 'DEBIT',
      description: 'WOOLWORTHS 1294 HORNSBY NS',
      month: 7,
      year: 2025,
    },
    {
      id: 'tx-2',
      date: '02/07/2025',
      amount: 15.99,
      type: 'DEBIT',
      description: 'NETFLIX',
      month: 7,
      year: 2025,
    },
    {
      id: 'tx-3',
      date: '03/07/2025',
      amount: 1200.0,
      type: 'DEBIT',
      description: 'DEFT PAYMENTS STRATA',
      month: 7,
      year: 2025,
    },
    {
      id: 'tx-4',
      date: '04/07/2025',
      amount: 45.0,
      type: 'DEBIT',
      description: 'CHEMIST WAREHOUSE',
      month: 7,
      year: 2025,
    },
    {
      id: 'tx-5',
      date: '05/07/2025',
      amount: 25.5,
      type: 'DEBIT',
      description: 'TRANSPORT NSW OPAL',
      month: 7,
      year: 2025,
    },
    {
      id: 'tx-6',
      date: '06/07/2025',
      amount: 35.0,
      type: 'DEBIT',
      description: 'UBER EATS DELIVERY',
      month: 7,
      year: 2025,
    },
  ];

  it('should classify all entries with valid category names from the provided list', async () => {
    const result = await classifyTransactions(australianTransactions, mockCategories);

    expect(result.classified).toHaveLength(australianTransactions.length);

    // All categories should be in the provided list
    const categoryNames = mockCategories.map((c) => c.name);
    for (const classified of result.classified) {
      expect(categoryNames).toContain(classified.llmCategory);
    }
  });

  it('should classify WOOLWORTHS as Groceries', async () => {
    const woolworthsTx = australianTransactions.filter((t) =>
      t.description.includes('WOOLWORTHS'),
    );

    const result = await classifyTransactions(woolworthsTx, mockCategories);

    expect(result.classified[0]!.llmCategory).toBe('Groceries');
  });

  it('should classify NETFLIX as Entertainment', async () => {
    const netflixTx = australianTransactions.filter((t) =>
      t.description.includes('NETFLIX'),
    );

    const result = await classifyTransactions(netflixTx, mockCategories);

    expect(result.classified[0]!.llmCategory).toBe('Entertainment');
  });

  it('should classify DEFT PAYMENTS STRATA as Home', async () => {
    const defTx = australianTransactions.filter((t) =>
      t.description.includes('DEFT'),
    );

    const result = await classifyTransactions(defTx, mockCategories);

    expect(result.classified[0]!.llmCategory).toBe('Home');
  });

  it('should classify CHEMIST WAREHOUSE as Health & Medical', async () => {
    const chemistTx = australianTransactions.filter((t) =>
      t.description.includes('CHEMIST'),
    );

    const result = await classifyTransactions(chemistTx, mockCategories);

    expect(result.classified[0]!.llmCategory).toBe('Health & Medical');
  });

  it('should classify TRANSPORT NSW as Vehicle & Transport', async () => {
    const transportTx = australianTransactions.filter((t) =>
      t.description.includes('TRANSPORT'),
    );

    const result = await classifyTransactions(transportTx, mockCategories);

    expect(result.classified[0]!.llmCategory).toBe('Vehicle & Transport');
  });

  it('should classify UBER EATS as Eating out & takeaway', async () => {
    const uberTx = australianTransactions.filter((t) =>
      t.description.includes('UBER'),
    );

    const result = await classifyTransactions(uberTx, mockCategories);

    expect(result.classified[0]!.llmCategory).toBe('Eating out & takeaway');
  });

  it('should return non-zero token usage from real LLM', async () => {
    const result = await classifyTransactions(
      australianTransactions.slice(0, 2),
      mockCategories,
    );

    expect(result.usage.totalTokens).toBeGreaterThan(0);
    expect(result.usage.promptTokens).toBeGreaterThan(0);
  });
});
