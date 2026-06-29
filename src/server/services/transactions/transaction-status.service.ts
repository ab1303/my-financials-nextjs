import { TransactionStatusEnum, TransactionTypeEnum } from '@prisma/client';

import {
  REIMBURSEMENT_CATEGORY,
  TRANSFER_CATEGORY,
} from '@/server/services/transactions/constants';

export function determineNewStatus(
  transaction: {
    status: TransactionStatusEnum;
    category: string;
    type: TransactionTypeEnum;
  },
  input: {
    newCategory: string;
  },
): { newStatus: TransactionStatusEnum; newConfirmedAt?: Date } {
  let newStatus = transaction.status;
  let newConfirmedAt: Date | undefined;

  if (input.newCategory === REIMBURSEMENT_CATEGORY) {
    if (
      transaction.type === TransactionTypeEnum.CREDIT &&
      transaction.status === TransactionStatusEnum.EXCLUDED
    ) {
      newStatus = TransactionStatusEnum.CONFIRMED;
      newConfirmedAt = new Date();
    } else if (
      transaction.type === TransactionTypeEnum.DEBIT &&
      transaction.status === TransactionStatusEnum.CONFIRMED
    ) {
      newStatus = TransactionStatusEnum.EXCLUDED;
    }
  } else if (
    transaction.category === REIMBURSEMENT_CATEGORY &&
    input.newCategory !== REIMBURSEMENT_CATEGORY
  ) {
    if (
      transaction.type === TransactionTypeEnum.CREDIT &&
      transaction.status === TransactionStatusEnum.CONFIRMED
    ) {
      newStatus = TransactionStatusEnum.EXCLUDED;
    } else if (
      transaction.type === TransactionTypeEnum.DEBIT &&
      transaction.status === TransactionStatusEnum.EXCLUDED
    ) {
      newStatus = TransactionStatusEnum.CONFIRMED;
      newConfirmedAt = new Date();
    }
  } else if (
    transaction.category === TRANSFER_CATEGORY &&
    input.newCategory !== TRANSFER_CATEGORY &&
    transaction.status === TransactionStatusEnum.EXCLUDED
  ) {
    newStatus = TransactionStatusEnum.CONFIRMED;
    newConfirmedAt = new Date();
  } else if (
    transaction.category !== TRANSFER_CATEGORY &&
    input.newCategory === TRANSFER_CATEGORY &&
    transaction.type === TransactionTypeEnum.DEBIT &&
    transaction.status === TransactionStatusEnum.CONFIRMED
  ) {
    newStatus = TransactionStatusEnum.EXCLUDED;
  } else if (
    transaction.status === TransactionStatusEnum.EXCLUDED &&
    input.newCategory !== TRANSFER_CATEGORY &&
    input.newCategory !== 'Excluded'
  ) {
    newStatus = TransactionStatusEnum.CONFIRMED;
    newConfirmedAt = new Date();
  }

  return { newStatus, newConfirmedAt };
}
