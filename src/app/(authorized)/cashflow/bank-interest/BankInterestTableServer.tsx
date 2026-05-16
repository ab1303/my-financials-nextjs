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

  const year = data.monthlyCredits[0]?.year ?? new Date().getFullYear();
  const dateFrom = `${year}-01-01`;
  const dateTo = `${year}-12-31`;

  return (
    <div className="space-y-8">
      <InterestCreditsTable
        credits={data.monthlyCredits}
        bankId={bankId}
        calendarYearId={calendarYearId}
      />
      <CleansingDonationsList
        donations={data.cleansingDonations}
        yearlySummary={data.yearlySummary}
        bankId={bankId}
        calendarYearId={calendarYearId}
        dateFrom={dateFrom}
        dateTo={dateTo}
        unlinkedInterestCount={data.unlinkedInterestCount}
      />
    </div>
  );
}
