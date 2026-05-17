import { prisma } from '@/server/db/client';
import type { CreateBankAccountInput } from '@/server/schema/bank-account.schema';

export const createBankAccount = async (
  input: CreateBankAccountInput & { userId: string },
) => {
  return prisma.bankAccount.create({
    data: { name: input.name, bankId: input.bankId, userId: input.userId },
    include: { bank: { select: { name: true } } },
  });
};

export const getBankAccounts = async (userId: string) => {
  return prisma.bankAccount.findMany({
    where: { userId },
    include: {
      bank: { select: { name: true } },
      _count: { select: { transactions: true } },
    },
    orderBy: [{ bank: { name: 'asc' } }, { name: 'asc' }],
  });
};

export const deleteBankAccount = async (id: string, userId: string) => {
  const deleted = await prisma.bankAccount.deleteMany({
    where: { id, userId },
  });

  return deleted;
};
