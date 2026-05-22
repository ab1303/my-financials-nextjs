import { countUnlinkedDonationTransactions } from '@/server/services/transactions/donation-link.service';
import { auth } from '@/server/auth';
import LinkZakatTransactionsDrawerTrigger from './LinkZakatTransactionsDrawerTrigger';

interface UnlinkedZakatTransactionsBannerProps {
  fromYear: number;
  toYear: number;
  dateFrom: string;
  dateTo: string;
  calendarYearId: string;
}

export default async function UnlinkedZakatTransactionsBanner({
  fromYear,
  toYear,
  dateFrom,
  dateTo,
  calendarYearId,
}: UnlinkedZakatTransactionsBannerProps) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const count = await countUnlinkedDonationTransactions(
    session.user.id,
    fromYear,
    toYear,
  );

  if (count === 0) return null;

  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 dark:border-blue-700 dark:bg-blue-950">
      <p className="text-sm text-blue-800 dark:text-blue-200">
        🔗 <strong>{count}</strong> &quot;Gifts &amp; donations&quot; transaction
        {count !== 1 ? 's' : ''} from your bank import could be Zakat payments.
      </p>
      <LinkZakatTransactionsDrawerTrigger
        dateFrom={dateFrom}
        dateTo={dateTo}
        calendarYearId={calendarYearId}
      />
    </div>
  );
}
