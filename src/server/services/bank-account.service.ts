import { prisma } from '@/server/db/client';
import type { CreateBankAccountInput } from '@/server/schema/bank-account.schema';

export const createBankAccount = async (
  input: CreateBankAccountInput & { userId: string },
) => {
  return prisma.financialAccount.create({
    data: {
      name: input.name,
      institutionId: input.institutionId,
      userId: input.userId,
    },
    include: { institution: { select: { name: true } } },
  });
};

export const getBankAccounts = async (userId: string) => {
  return prisma.financialAccount.findMany({
    where: { userId },
    include: {
      institution: { select: { name: true } },
      _count: { select: { transactions: true } },
    },
    orderBy: [{ institution: { name: 'asc' } }, { name: 'asc' }],
  });
};

export const deleteBankAccount = async (id: string, userId: string) => {
  const deleted = await prisma.financialAccount.deleteMany({
    where: { id, userId },
  });

  return deleted;
};

export const updateTracking = async (
  accountId: string,
  isTracked: boolean,
  userId: string,
) => {
  const updated = await prisma.financialAccount.updateMany({
    where: { id: accountId, userId },
    data: { isTracked },
  });

  if (updated.count === 0) {
    throw new Error('Bank account not found');
  }

  return prisma.financialAccount.findFirstOrThrow({
    where: { id: accountId, userId },
    select: { id: true, isTracked: true },
  });
};
