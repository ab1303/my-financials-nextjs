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
  // BANK and BROKERAGE are global institutions (userId = null).
  // All other types (PHILANTHROPY, untyped) are user-specific.
  const isGlobalType = type === 'BANK' || type === 'BROKERAGE';
  const whereCondition: Prisma.BusinessWhereInput = isGlobalType
    ? { userId: null, ...(type && { type: type as any }) }
    : { userId, ...(type && { type: type as any }) };

  return (await prisma.business.findMany({
    where: whereCondition,
  })) as Array<Business>;
};

export const updateBusinessDetails = async (
  id: string,
  input: Prisma.BusinessUncheckedUpdateInput,
) => {
  return await prisma.business.update({
    where: { id },
    data: { ...input },
  }) as Business;
};

export const deleteBusinessDetails = async (id: string) => {
  return await prisma.business.delete({
    where: { id },
  });
};

/**
 * Validates that a business name is unique for a user.
 * For PHILANTHROPY businesses, names must be unique per user.
 * @param name - Business name to check
 * @param userId - User ID to scope the uniqueness check
 * @param excludeId - Optional business ID to exclude from the check (for updates)
 * @returns true if name is unique, false if already exists
 */
export const validateBusinessNameUniqueness = async (
  name: string,
  userId: string,
  excludeId?: string,
) => {
  const existing = await prisma.business.findFirst({
    where: {
      name: {
        equals: name.trim(),
        mode: 'insensitive',
      },
      userId,
      ...(excludeId && { id: { not: excludeId } }),
    },
  });

  return existing === null; // true if name is unique
};
