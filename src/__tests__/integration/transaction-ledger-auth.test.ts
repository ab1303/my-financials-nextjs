import { TRPCError } from '@trpc/server';
import { describe, expect, it, vi } from 'vitest';

import { transactionLedgerRouter } from '@/server/trpc/router/transaction-ledger';

// Mock context with an authenticated user
const mockCtx = {
  session: {
    user: { id: 'test-user', name: 'Test User' },
    expires: '2026-06-10T12:00:00.000Z',
  },
  prisma: {
    transaction: {
      findMany: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    },
  },
};

describe('Transaction Ledger Router Authentication', () => {
  it('should allow access to getAll when user is authenticated', async () => {
    const caller = transactionLedgerRouter.createCaller(mockCtx as any);

    // Call getAll without input just to test the procedure's authentication check
    // We expect it to succeed or fail with validation error, not unauthorized error.
    await expect(caller.getAll({ limit: 1 })).resolves.toBeDefined();
  });

  it('should throw UNAUTHORIZED when user is not in context', async () => {
    const unauthedCtx = { session: null };
    const caller = transactionLedgerRouter.createCaller(unauthedCtx as any);

    await expect(caller.getAll({ limit: 1 })).rejects.toThrow(TRPCError);
  });
});
