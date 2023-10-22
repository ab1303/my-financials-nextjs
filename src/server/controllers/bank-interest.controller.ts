import { handleCaughtError } from '@/server/utils/prisma';
import {
  addBankInterestPaymentDetail,
  getBankInterestDetails,
  updateBankInterestDetail,
} from '@/server/services/bank-interest.service';

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

export const updateBankInterestDetailsHandler = async (
  id: string,
  bankId: string,
  year: number,
  amountDue: number
) => {
  try {
    await updateBankInterestDetail(id, bankId, year, amountDue);
  } catch (e) {
    handleCaughtError(e);
  }
};

export const createBankInterestPaymentHandler = async (
  bankInterestId: string,
  businessId: string,
  amount: number,
  datePaid: Date
) => {
  try {
    const createPayment = await addBankInterestPaymentDetail(bankInterestId, {
      amount,
      datePaid,
      businessId,
    });
    return { paymentId: createPayment.id };
  } catch (e) {
    handleCaughtError(e);

    return { paymentId: '' };
  }
};
