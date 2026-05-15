import { countUnlinkedDonationTransactions } from '@/server/services/transactions/donation-link.service';
import { auth } from '@/server/auth';

import LinkTransactionsDrawerTrigger from './LinkTransactionsDrawerTrigger';

interface UnlinkedTransactionsBannerProps {
  fromYear: number;
  toYear: number;
  dateFrom: string; // ISO YYYY-MM-DD for tRPC param passthrough
  dateTo: string;
  calendarYearId: string;
}

export default async function UnlinkedTransactionsBanner({
  fromYear,
  toYear,
  dateFrom,
  dateTo,
  calendarYearId,
}: UnlinkedTransactionsBannerProps) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const count = await countUnlinkedDonationTransactions(
    session.user.id,
    fromYear,
    toYear,
  );

  if (count === 0) return null;

  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950">
      <p className="text-sm text-amber-800 dark:text-amber-200">
        🔗 <strong>{count}</strong> &quot;Gifts &amp; donations&quot; transaction
        {count !== 1 ? 's' : ''} from your bank import need recipient details.
      </p>
      <LinkTransactionsDrawerTrigger
        dateFrom={dateFrom}
        dateTo={dateTo}
        calendarYearId={calendarYearId}
      />
    </div>
  );
}