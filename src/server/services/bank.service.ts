import type { Prisma, Bank } from '@prisma/client';
import { prisma } from '../utils/prisma';

export const addBankDetails = async (input: Prisma.BankCreateInput) => {
  const result = await prisma.bank.create({ data: input });
  return result as Bank;
};

export const getBankDetails = async (
  where?: Partial<Prisma.BankWhereUniqueInput>,
  select?: Prisma.BankSelect
) => {
  return (await prisma.bank.findMany({
    where,
    select,
  })) as Array<Bank>;
};

export const deleteBankDetails = async (id: string) => {
  return await prisma.bank.delete({
    where: { id },
  });
};
