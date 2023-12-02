import {
  addZakatCalendarYearDetails,
  getZakat,
  getZakatPayments,
} from '../services/zakat.service';
import { handleCaughtError } from '../utils/prisma';

export const createZakatYearHandler = async (
  zakatCalendarYearId: string,
  totalAmount: number
) => {
  try {
    const zakat = await getZakat(zakatCalendarYearId);
    if (!!zakat.id) return { zakatCalendarId: zakat.id };

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
    const zakatPayment = await getZakat(calendarYearId);
    return zakatPayment;
  } catch (e) {
    handleCaughtError(e);
  }
};
