import { Prisma, Relationship } from '@prisma/client';
import { prisma } from '../utils/prisma';

export const addRelationship = async (
  input: Prisma.RelationshipUncheckedCreateInput,
) => {
  const result = await prisma.relationship.create({ data: { ...input } });
  return result as Relationship;
};

export const getRelationships = async (
  where?: Prisma.RelationshipWhereInput,
  select?: Prisma.RelationshipSelect,
) => {
  return (await prisma.relationship.findMany({
    where,
    select,
    orderBy: { name: 'asc' }, // Sort relationships alphabetically for consistent dropdown ordering
  })) as Array<Relationship>;
};

export const getRelationshipById = async (id: string) => {
  return (await prisma.relationship.findUnique({
    where: { id },
  })) as Relationship | null;
};

export const getRelationshipByNameAndUser = async (
  name: string,
  userId: string,
) => {
  return (await prisma.relationship.findUnique({
    where: {
      name_userId: {
        name,
        userId,
      },
    },
  })) as Relationship | null;
};

export const updateRelationship = async (
  id: string,
  input: Prisma.RelationshipUncheckedUpdateInput,
) => {
  return (await prisma.relationship.update({
    where: { id },
    data: { ...input },
  })) as Relationship;
};

export const deleteRelationship = async (id: string) => {
  return await prisma.relationship.delete({
    where: { id },
  });
};

// Helper function to get or create a relationship for a user
export const getOrCreateRelationship = async (name: string, userId: string) => {
  // Check if relationship already exists for this user
  const existing = await getRelationshipByNameAndUser(name, userId);

  if (existing) {
    return existing;
  }

  // Create new relationship if it doesn't exist
  return await addRelationship({
    name: name.trim(), // Trim whitespace
    userId,
  });
};
