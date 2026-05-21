import { prisma } from '@/server/utils/prisma';

/**
 * Bulk update all transactions with a given old category name to a new category name.
 * Returns the count of updated records.
 */
export const updateTransactionCategory = async (
  oldCategory: string,
  newCategory: string,
): Promise<number> => {
  const result = await prisma.transaction.updateMany({
    where: { category: { equals: oldCategory, mode: 'insensitive' } },
    data: { category: newCategory },
  });
  return result.count;
};
