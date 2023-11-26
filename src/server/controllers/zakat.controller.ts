import {
  addZakatCalendarYearDetails,
  getZakatPayment,
  getZakatPayments,
} from '../services/zakat.service';
import { handleCaughtError } from '../utils/prisma';

export const createZakatYearHandler = async (
  zakatCalendarYearId: string,
  totalAmount: number
) => {
  try {
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

export const zakatPaymentsHandler = async (calendarYearId: string) => {
  try {
    const zakatPayments = await getZakatPayments(calendarYearId);
    return zakatPayments;
  } catch (e) {
    handleCaughtError(e);
  }
};

export const zakatHandler = async (calendarYearId: string) => {
  try {
    const zakatPayment = await getZakatPayment(calendarYearId);
    return zakatPayment;
  } catch (e) {
    handleCaughtError(e);
  }
};
