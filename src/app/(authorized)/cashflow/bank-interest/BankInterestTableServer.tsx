import { auth } from '@/server/auth';
import { getYearlyCleansingData } from '@/server/services/bank-interest/interest-cleansing.service';

import InterestCreditsTable from './InterestCreditsTable';
import CleansingDonationsList from './_components/CleansingDonationsList';

export type BankInterestTableServerProps = {
  bankId: string;
  calendarYearId: string;
};

export default async function BankInterestTableServer({
  bankId,
  calendarYearId,
}: BankInterestTableServerProps) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const data = await getYearlyCleansingData(bankId, calendarYearId, session.user.id);

  // FIX: Use dateFrom/dateTo from service (respects fromMonth/toMonth from calendarYear)
  const { dateFrom, dateTo } = data;

  return (
    <div className="space-y-8">
      <CleansingDonationsList
        donations={data.cleansingDonations}
        yearlySummary={data.yearlySummary}
        bankId={bankId}
        calendarYearId={calendarYearId}
        dateFrom={dateFrom}
        dateTo={dateTo}
        unlinkedInterestCount={data.unlinkedInterestCount}
      />
      <InterestCreditsTable
        credits={data.monthlyCredits}
        bankId={bankId}
        calendarYearId={calendarYearId}
      />
    </div>
  );
}
