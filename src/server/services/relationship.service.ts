import { Prisma, RelationshipType } from '@prisma/client';
import { prisma } from '../utils/prisma';

export const addRelationship = async (
  input: Prisma.RelationshipTypeUncheckedCreateInput,
) => {
  const result = await prisma.relationshipType.create({ data: { ...input } });
  return result as RelationshipType;
};

export const getRelationships = async (
  where?: Prisma.RelationshipTypeWhereInput,
  select?: Prisma.RelationshipTypeSelect,
) => {
  return (await prisma.relationshipType.findMany({
    where,
    select,
    orderBy: { name: 'asc' }, // Sort relationships alphabetically for consistent dropdown ordering
  })) as Array<RelationshipType>;
};

export const getRelationshipById = async (id: string) => {
  return (await prisma.relationshipType.findUnique({
    where: { id },
  })) as RelationshipType | null;
};

export const getRelationshipByNameAndUser = async (
  name: string,
  userId: string,
) => {
  return (await prisma.relationshipType.findUnique({
    where: {
      name_userId: {
        name,
        userId,
      },
    },
  })) as RelationshipType | null;
};

export const updateRelationship = async (
  id: string,
  input: Prisma.RelationshipTypeUncheckedUpdateInput,
) => {
  return (await prisma.relationshipType.update({
    where: { id },
    data: { ...input },
  })) as RelationshipType;
};

export const deleteRelationship = async (id: string) => {
  return await prisma.relationshipType.delete({
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
