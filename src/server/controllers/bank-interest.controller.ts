import { handleCaughtError } from '@/server/utils/prisma';
import { getBankInterestDetails } from '@/server/services/bank-interest.service';

export const bankInterestDetailsHandler = async (
  bankId: string,
  year: number
) => {
  try {
    const bankInterestDetails = await getBankInterestDetails(bankId, year);
    return bankInterestDetails;
  } catch (e) {
    handleCaughtError(e);
  }
};
