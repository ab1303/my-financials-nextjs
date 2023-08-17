import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import type { CreateBankInput } from '@/server/schema/bank.schema';
import { addBankDetails, getBankDetails } from '@/server/services/bank.service';

export const addBankDetailsHandler = async ({
  input,
}: {
  input: CreateBankInput;
}) => {
  try {
    const bankResult = await addBankDetails({
      name: input.name,
      addressLine: input.addressLine,
      streetAddress: input.streetAddress,
      postcode: input.postcode,
      state: input.state,
      suburb: input.suburb,
    });
    return {
      status: 'success',
      data: {
        bank: bankResult,
      },
    };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: e.message,
      });
    }
    throw e;
  }
};

export const allBankDetails = async () => {
  try {
    const bankDetails = await getBankDetails();
    return bankDetails;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: e.message,
      });
    }
    throw e;
  }
};
