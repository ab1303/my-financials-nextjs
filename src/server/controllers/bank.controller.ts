import { handleCaughtError } from '@/server/utils/prisma';
import type { CreateBankInput, ParamsInput } from '@/server/schema/bank.schema';
import {
  addBankDetails,
  deleteBankDetails,
  getBankDetails,
} from '@/server/services/bank.service';

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
      type: 'BANK',
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
