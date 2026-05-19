import type { Prisma, Business } from '@prisma/client';
import { prisma } from '../utils/prisma';

export const addBrokerageDetails = async (
  input: Omit<Prisma.BusinessUncheckedCreateInput, 'userId'>
) => {
  const result = await prisma.business.create({
    data: { ...input, userId: null, type: 'BROKERAGE' },
  });
  return result as Business;
};

export const getBrokerageDetails = async (
  where?: Partial<Prisma.BusinessWhereUniqueInput>,
  select?: Prisma.BusinessSelect
) => {
  const finalWhere: Partial<Prisma.BusinessWhereUniqueInput> = {
    ...where,
    type: 'BROKERAGE',
    userId: null, // Only global brokerages
  };
  return (await prisma.business.findMany({
    where: finalWhere,
    select,
  })) as Array<Business>;
};

export const deleteBrokerageDetails = async (id: string) => {
  // Check for dependent accounts
  const accountCount = await prisma.financialAccount.count({
    where: { institutionId: id },
  });
  if (accountCount > 0) {
    throw new Error(
      `Cannot delete brokerage: ${accountCount} account(s) depend on this institution`
    );
  }
  return await prisma.business.delete({
    where: { id, type: 'BROKERAGE', userId: null },
  });
};
