import { auth } from '@/server/auth';
import { getInterestCleansingData } from '@/server/services/bank-interest/interest-cleansing.service';

import BankInterestTableClient from './BankInterestTableClient';
import { BankInterestStateProvider } from './StateProvider';
import type { BankInterestType } from './_types';

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

  const cleansingData = await getInterestCleansingData(
    bankId,
    calendarYearId,
    session.user.id,
  );

  const data: BankInterestType[] = cleansingData.map((d) => ({
    id: d.bankInterestLiabilityId,
    month: d.month,
    year: d.year,
    receivedFromLedger: d.receivedFromLedger,
    manualOverride: d.manualOverride,
    receivedTotal: d.receivedTotal,
    amountCleansed: d.amountCleansed,
    balance: d.balance,
    status: d.status,
    uncleansedTxCount: d.uncleansedTxCount,
  }));

  const unlinkedCount = cleansingData.reduce(
    (sum, d) => sum + d.uncleansedTxCount,
    0,
  );

  const yearlySummary = {
    totalReceived: cleansingData.reduce((sum, d) => sum + d.receivedTotal, 0),
    totalCleansed: cleansingData.reduce((sum, d) => sum + d.amountCleansed, 0),
    remaining: cleansingData.reduce((sum, d) => sum + d.balance, 0),
  };

  const year = cleansingData[0]?.year;
  const dateFrom = year ? `${year}-01-01` : '';
  const dateTo = year ? `${year}-12-31` : '';

  return (
    <BankInterestStateProvider data={data}>
      <BankInterestTableClient
        bankId={bankId}
        calendarYearId={calendarYearId}
        unlinkedCount={unlinkedCount}
        yearlySummary={yearlySummary}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />
    </BankInterestStateProvider>
  );
}
