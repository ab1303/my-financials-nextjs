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

export const getBusinessDetailsByType = async (
  userId: string,
  type?: string,
) => {
  const whereCondition: Prisma.BusinessWhereInput = {
    userId,
    ...(type && { type: type as any }),
  };

  return (await prisma.business.findMany({
    where: whereCondition,
  })) as Array<Business>;
};

export const deleteBusinessDetails = async (id: string) => {
  return await prisma.business.delete({
    where: { id },
  });
};
