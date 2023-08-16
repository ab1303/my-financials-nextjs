import type { Prisma, Bank } from '@prisma/client';
import { prisma } from '../utils/prisma';

export const addBankDetails = async (input: Prisma.BankCreateInput) => {
  const result = await prisma.bank.create({ data: input });
  return result as Bank;
};
