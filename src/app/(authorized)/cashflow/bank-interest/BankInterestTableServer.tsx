import { auth } from '@/server/auth';
import { getYearlyCleansingData } from '@/server/services/interest-cleansing/interest-cleansing.service';

import CleansingDonationsList from './_components/CleansingDonationsList';
import InterestCreditsTable from './InterestCreditsTable';

export type BankInterestTableServerProps = {
  institutionId: string;
  calendarYearId: string;
};

export default async function BankInterestTableServer({
  institutionId,
  calendarYearId,
}: BankInterestTableServerProps) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const data = await getYearlyCleansingData(
    institutionId,
    calendarYearId,
    session.user.id,
  );

  // FIX: Use dateFrom/dateTo from service (respects fromMonth/toMonth from calendarYear)
  const { dateFrom, dateTo } = data;

  return (
    <div className='space-y-8'>
      <CleansingDonationsList
        donations={data.cleansingDonations}
        yearlySummary={data.yearlySummary}
        institutionId={institutionId}
        calendarYearId={calendarYearId}
        dateFrom={dateFrom}
        dateTo={dateTo}
        unlinkedInterestCount={data.unlinkedInterestCount}
      />
      <InterestCreditsTable credits={data.monthlyCredits} />
    </div>
  );
}
