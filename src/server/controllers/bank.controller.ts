import { handleCaughtError } from '@/server/utils/prisma';
import {
  addBankDetails,
  deleteBankDetails,
  getBankDetails,
} from '@/server/services/bank.service';

import type { CreateBankInput, ParamsInput } from '@/server/schema/bank.schema';

export const addBankDetailsHandler = async ({
  input,
  userId,
}: {
  input: CreateBankInput;
  userId: string;
}) => {
  try {
    const bankResult = await addBankDetails({
      name: input.name,
      addressLine: input.addressLine,
      streetAddress: input.streetAddress,
      postcode: input.postcode,
      state: input.state,
      suburb: input.suburb,
      type: 'BANK',
      userId,
    });
    return {
      status: 'success',
      data: {
        bank: bankResult,
      },
    };
  } catch (e) {
    handleCaughtError(e);
  }
};

export const allBankDetailsHandler = async () => {
  try {
    const bankDetails = await getBankDetails();
    return bankDetails;
  } catch (e) {
    handleCaughtError(e);
  }
};

export const removeBankDetailsHandler = async ({
  params,
}: {
  params: ParamsInput;
}) => {
  try {
    await deleteBankDetails(params.bankId);
  } catch (e) {
    handleCaughtError(e);
  }
};
