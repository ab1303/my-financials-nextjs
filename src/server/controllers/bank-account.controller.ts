import { TRPCError } from '@trpc/server';
import {
  createBankAccount,
  deleteBankAccount,
  getBankAccounts,
} from '@/server/services/bank-account.service';
import type {
  CreateBankAccountInput,
  DeleteBankAccountInput,
} from '@/server/schema/bank-account.schema';

export const listBankAccountsHandler = async (userId: string) => {
  return getBankAccounts(userId);
};

export const createBankAccountHandler = async (
  input: CreateBankAccountInput,
  userId: string,
) => {
  try {
    return await createBankAccount({ ...input, userId });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'An account with this name already exists at this bank.',
      });
    }
    throw e;
  }
};

export const deleteBankAccountHandler = async (
  input: DeleteBankAccountInput,
  userId: string,
) => {
  const result = await deleteBankAccount(input.id, userId);

  if (result.count === 0) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Bank account not found.',
    });
  }

  return result;
};
