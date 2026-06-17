
import { TransactionStatusEnum, TransactionTypeEnum } from '@prisma/client';
import { determineNewStatus } from '@/server/services/transactions/transaction-status.service';
import { expect, test } from 'vitest';

test('determineNewStatus should set status to CONFIRMED when changing category from EXCLUDED to something else', () => {
  const transaction = {
    status: TransactionStatusEnum.EXCLUDED,
    category: 'SomeOldCategory',
    type: TransactionTypeEnum.DEBIT,
  };
  const input = {
    newCategory: 'Groceries',
  };
  
  const result = determineNewStatus(transaction, input);
  expect(result.newStatus).toBe(TransactionStatusEnum.CONFIRMED);
});

test('determineNewStatus should keep status as EXCLUDED when changing category to Excluded', () => {
    const transaction = {
      status: TransactionStatusEnum.EXCLUDED,
      category: 'SomeOldCategory',
      type: TransactionTypeEnum.DEBIT,
    };
    const input = {
      newCategory: 'Excluded',
    };
    
    const result = determineNewStatus(transaction, input);
    expect(result.newStatus).toBe(TransactionStatusEnum.EXCLUDED);
  });
