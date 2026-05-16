import type { GetNetWorthTrendInput } from '@/server/schema/asset-dashboard.schema';
import {
  getNetWorthTrend,
  resolveDateRangeFromCalendarYear,
} from '@/server/services/asset-dashboard.service';
import { handleCaughtError } from '@/server/utils/prisma';
import type { NetWorthTrendFilters } from '@/types/asset-dashboard.types';

export const getNetWorthTrendHandler = async ({
  input,
  userId,
}: {
  input: GetNetWorthTrendInput;
  userId: string;
}) => {
  try {
    const filters: NetWorthTrendFilters = {};

    if (input.calendarYearId) {
      const { fromDate, toDate } = await resolveDateRangeFromCalendarYear(
        input.calendarYearId,
      );
      filters.fromDate = fromDate;
      filters.toDate = toDate;
      filters.calendarYearId = input.calendarYearId;
    } else {
      if (input.fromDate) {
        filters.fromDate = input.fromDate;
      }
      if (input.toDate) {
        filters.toDate = input.toDate;
      }
    }

    return await getNetWorthTrend(userId, filters);
  } catch (e) {
    handleCaughtError(e);
  }
};
