import { describe, it, expect, beforeAll, skipIf } from 'vitest';
import { classifyTransactions } from '@/server/services/ai-import/csv-classifier.service';
import type { CsvTransaction } from '@/server/services/ai-import/_types';
import type { ExpenseCategory } from '@prisma/client';

// Skip if AI_API_KEY is not set (integration tests require real API)
const shouldRun = !!process.env.AI_API_KEY;

describe.skipIf(!shouldRun)('csv-classifier.service (integration)', () => {
  const mockCategories: ExpenseCategory[] = [
    {
      id: '1',
      name: 'Groceries',
      iconName: null,
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: '2',
      name: 'Entertainment',
      iconName: null,
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: '3',
      name: 'Home',
      iconName: null,
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: '4',
      name: 'Health & Medical',
      iconName: null,
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: '5',
      name: 'Vehicle & Transport',
      iconName: null,
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: '6',
      name: 'Eating out & takeaway',
      iconName: null,
      isActive: true,
      createdAt: new Date(),
    },
  ];

  const australianTransactions: CsvTransaction[] = [
    {
      date: '01/07/2025',
      amount: 85.5,
      description: 'WOOLWORTHS 1294 HORNSBY NS',
      month: 7,
      year: 2025,
    },
    {
      date: '02/07/2025',
      amount: 15.99,
      description: 'NETFLIX',
      month: 7,
      year: 2025,
    },
    {
      date: '03/07/2025',
      amount: 1200.0,
      description: 'DEFT PAYMENTS STRATA',
      month: 7,
      year: 2025,
    },
    {
      date: '04/07/2025',
      amount: 45.0,
      description: 'CHEMIST WAREHOUSE',
      month: 7,
      year: 2025,
    },
    {
      date: '05/07/2025',
      amount: 25.5,
      description: 'TRANSPORT NSW OPAL',
      month: 7,
      year: 2025,
    },
    {
      date: '06/07/2025',
      amount: 35.0,
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
