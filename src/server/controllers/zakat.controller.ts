import {
  addZakatCalendarYearDetails,
  getZakat,
  getZakatPayments,
  getZakatTotalsByCategory,
  getZakatTotalsByBeneficiary,
  getZakatTotalPaid,
  updateZakatObligation,
} from '../services/zakat/zakat.service';
import { handleCaughtError } from '../utils/prisma';
// ... (rest of imports)

export const zakatTotalPaidHandler = async (calendarYearId: string) => {
  try {
    return await getZakatTotalPaid(calendarYearId);
  } catch (e) {
    handleCaughtError(e);
    return 0;
  }
};

export const createZakatYearHandler = async (
  zakatCalendarYearId: string,
  totalAmount: number
) => {
  try {
    const zakat = await getZakat(zakatCalendarYearId);
    if (zakat.id) {
      await updateZakatObligation(zakat.id, totalAmount);
      return { zakatCalendarId: zakat.id };
    }

    const zakatCalendarYear = await addZakatCalendarYearDetails({
      calendarId: zakatCalendarYearId,
      amountDue: totalAmount,
    });

    return { zakatCalendarId: zakatCalendarYear.id };
  } catch (e) {
    handleCaughtError(e);

    return { zakatCalendarId: '' };
  }
};

export const zakatPaymentsHandler = async (calendarYearId: string, beneficiaryId?: string) => {
  try {
    const zakatPayments = await getZakatPayments(calendarYearId, beneficiaryId);
    return zakatPayments;
  } catch (e) {
    handleCaughtError(e);
  }
};

export const zakatHandler = async (calendarYearId: string) => {
  try {
    const zakatPayment = await getZakat(calendarYearId);
    return zakatPayment;
  } catch (e) {
    handleCaughtError(e);
  }
};

/**
 * Handler that returns zakat totals broken down by deductible status.
 * Used for displaying comprehensive zakat reporting metrics.
 */
export const zakatTotalsByCategoryHandler = async (
  calendarYearId: string,
) => {
  try {
    const totals = await getZakatTotalsByCategory(calendarYearId);
    return totals;
  } catch (e) {
    handleCaughtError(e);
    return {
      deductibleTotal: 0,
      nonDeductibleTotal: 0,
    };
  }
};

/**
 * Handler that returns zakat totals broken down by beneficiary.
 */
export const zakatTotalsByBeneficiaryHandler = async (
  calendarYearId: string,
) => {
  try {
    const totals = await getZakatTotalsByBeneficiary(calendarYearId);
    return totals;
  } catch (e) {
    handleCaughtError(e);
    return [];
  }
};
