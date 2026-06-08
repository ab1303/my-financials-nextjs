import type { Transaction, TransactionSourceEnum,TransactionStatusEnum, TransactionTypeEnum } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/** Creates a mock CREDIT Transaction representing an income entry */
export const createMockIncomeTransaction = (overrides?: Partial<Transaction>): Transaction => ({
  id: 'test-entry-id',
  userId: 'test-user-id',
  type: 'CREDIT' as TransactionTypeEnum,
  source: 'USER_MANUAL' as TransactionSourceEnum,
  status: 'CONFIRMED' as TransactionStatusEnum,
  date: new Date('2024-01-15'),
  amount: new Decimal('5000.00'),
  category: 'Employment',
  description: 'Manual income: Employment',
  bankAccountId: null,
  importSessionId: null,
  confirmedAt: new Date('2024-01-15'),
  offsetCategory: null,
  offsetTransactionId: null,
  transferLinkedTransactionId: null,
  preLinkCategory: null,
  preLinkStatus: null,
  preVoidStatus: null,
  orphanResolution: null,
  runningBalance: null,
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-15'),
  ...overrides,
});

export const createMockMonthlySummary = () => ({
  month: '2024-01',
  totalAmount: new Decimal('10000.00'),
  entryCount: 2,
});
export const createMockSourceBreakdown = () => ({
  source: 'Employment',
  amount: new Decimal('5000.00'),
  count: 1,
});