import { handleCaughtError } from '@/server/utils/prisma';
import {
  addBankInterestPaymentDetail,
  getBankInterestDetails,
  removeBankInterestPaymentDetail,
  updateBankInterestDetail,
  updateBankInterestPaymentDetail,
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
  businessId: string | null,
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

export const updateBankInterestPaymentHandler = async (
  bankInterestId: string,
  paymentId: string,
  payment: number
) => {
  try {
    return await updateBankInterestPaymentDetail(
      bankInterestId,
      paymentId,
      payment
    );
  } catch (e) {
    handleCaughtError(e);
  }
};

export const removeBankInterestPaymentHandler = async (
  bankInterestId: string,
  paymentId: string
) => {
  try {
    return await removeBankInterestPaymentDetail(bankInterestId, paymentId);
  } catch (e) {
    handleCaughtError(e);
  }
};
