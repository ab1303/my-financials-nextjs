import { handleCaughtError } from '@/server/utils/prisma';
import type { BankInterestModel } from '@/server/models';
import {
  addBankInterestPaymentDetail,
  getBankInterestDetails,
  initializeBankInterestYear,
  removeBankInterestPaymentDetail,
  updateBankInterestDetail,
  updateBankInterestPaymentDetail,
} from '@/server/services/bank-interest.service';

export const initializeBankInterestYearHandler = async (
  bankId: string,
  calendarYearId: string,
): Promise<void> => {
  try {
    await initializeBankInterestYear(bankId, calendarYearId);
  } catch (e) {
    handleCaughtError(e);
    throw e; // TypeScript: unreachable but satisfies type checker
  }
};

export const bankInterestDetailsHandler = async (
  bankId: string,
  yearId: string
): Promise<BankInterestModel[]> => {
  try {
    const bankInterestDetails = await getBankInterestDetails(bankId, yearId);
    return bankInterestDetails;
  } catch (e) {
    handleCaughtError(e);
    throw e; // TypeScript: unreachable but satisfies type checker
  }
};

export const updateBankInterestDetailsHandler = async (
  id: string,
  bankId: string,
  calendarYearId: string,
  amountDue: number
): Promise<void> => {
  try {
    await updateBankInterestDetail(id, bankId, calendarYearId, amountDue);
  } catch (e) {
    handleCaughtError(e);
    throw e; // TypeScript: unreachable but satisfies type checker
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
    throw e; // TypeScript: unreachable but satisfies type checker
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
    throw e; // TypeScript: unreachable but satisfies type checker
  }
};
