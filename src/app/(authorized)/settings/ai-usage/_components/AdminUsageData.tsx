import {
  getAllUsersAIUsage,
  getExchangeRate,
} from '@/server/services/ai-usage-queries';
import AdminUsageTable from './AdminUsageTable';

type Props = {
  dateFrom: Date;
  dateTo: Date;
  dateFromStr: string;
  dateToStr: string;
};

/** Async RSC — parallel fetch of usage rows + exchange rate */
export default async function AdminUsageData({
  dateFrom,
  dateTo,
  dateFromStr,
  dateToStr,
}: Props) {
  const [rows, rate] = await Promise.all([
    getAllUsersAIUsage(dateFrom, dateTo),
    getExchangeRate(),
  ]);

  return (
    <AdminUsageTable
      rows={rows}
      exchangeRate={rate}
      dateFrom={dateFromStr}
      dateTo={dateToStr}
    />
  );
}
