import { addZakatCalendarYearDetails } from '../services/zakat.service';
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
