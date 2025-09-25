import { Prisma, Individual } from '@prisma/client';
import { prisma } from '../utils/prisma';

// Include relationship data in Individual queries
const individualInclude = {
  relationship: true,
} as const;

export const addIndividualDetails = async (
  input: Prisma.IndividualUncheckedCreateInput,
) => {
  const result = await prisma.individual.create({
    data: { ...input },
    include: individualInclude,
  });
  return result;
};

export const getIndividualDetails = async (
  where?: Prisma.IndividualWhereInput,
  select?: Prisma.IndividualSelect,
) => {
  // If select is provided, use it (without include)
  if (select) {
    return await prisma.individual.findMany({
      where,
      select,
      orderBy: { name: 'asc' },
    });
  }

  // Otherwise, use include to get relationship data
  return await prisma.individual.findMany({
    where,
    include: individualInclude,
    orderBy: { name: 'asc' },
  });
};

export const getIndividualById = async (id: string) => {
  return await prisma.individual.findUnique({
    where: { id },
    include: individualInclude,
  });
};

export const getIndividualByNameAndUser = async (
  name: string,
  userId: string,
) => {
  return await prisma.individual.findFirst({
    where: {
      name: {
        equals: name,
        mode: 'insensitive', // Case-insensitive search for uniqueness validation
      },
      userId,
    },
    include: individualInclude,
  });
};

export const updateIndividualDetails = async (
  id: string,
  input: Prisma.IndividualUncheckedUpdateInput,
) => {
  return await prisma.individual.update({
    where: { id },
    data: { ...input },
    include: individualInclude,
  });
};

export const deleteIndividualDetails = async (id: string) => {
  return await prisma.individual.delete({
    where: { id },
  });
};

// Helper function to validate individual name uniqueness for a user
export const validateIndividualNameUniqueness = async (
  name: string,
  userId: string,
  excludeId?: string, // For update operations, exclude the current individual
) => {
  const existing = await prisma.individual.findFirst({
    where: {
      name: {
        equals: name.trim(),
        mode: 'insensitive',
      },
      userId,
      ...(excludeId && { id: { not: excludeId } }), // Exclude current individual for updates
    },
  });

  return existing === null; // Returns true if name is unique
};
