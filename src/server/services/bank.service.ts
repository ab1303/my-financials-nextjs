import type { Prisma, Business } from '@prisma/client';
import { prisma } from '../utils/prisma';

export const addBankDetails = async (input: Prisma.BusinessCreateInput) => {
  const result = await prisma.business.create({ data: input });
  return result as Business;
};

export const getBankDetails = async (
  where?: Partial<Prisma.BusinessWhereUniqueInput>,
  select?: Prisma.BusinessSelect
) => {
  const finalWhere: Partial<Prisma.BusinessWhereUniqueInput> = {
    ...where,
    type: 'BANK',
  };
  return (await prisma.business.findMany({
    where: finalWhere,
    select,
  })) as Array<Business>;
};

export const deleteBankDetails = async (id: string) => {
  return await prisma.business.delete({
    where: { id, type: 'BANK' },
  });
};
