import { Prisma, Business } from '@prisma/client';
import { prisma } from '../utils/prisma';

export const addBusinessDetails = async (
  input: Prisma.BusinessUncheckedCreateInput,
) => {
  const result = await prisma.business.create({ data: { ...input } });
  return result as Business;
};

export const getBusinessDetails = async (
  where?: Prisma.BusinessWhereInput,
  select?: Prisma.BusinessSelect,
) => {
  return (await prisma.business.findMany({
    where,
    select,
  })) as Array<Business>;
};

export const deleteBusinessDetails = async (id: string) => {
  return await prisma.business.delete({
    where: { id },
  });
};
