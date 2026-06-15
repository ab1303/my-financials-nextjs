import { prisma } from '@/server/db/client';

import { getInterestCleansingPayments } from '../interest-cleansing/interest-cleansing.service';
import { getVoluntaryDonations } from '../voluntary-donations/voluntary-donation.service';
import { getZakatPayments } from '../zakat/zakat.service';

export const getDonationPaymentsAggregated = async (
  calendarYearId: string,
  beneficiaryId?: string,
) => {
  const [voluntary, zakat, interest] = await Promise.all([
    getVoluntaryDonations(calendarYearId, beneficiaryId),
    getZakatPayments(calendarYearId, beneficiaryId),
    getInterestCleansingPayments(calendarYearId, beneficiaryId),
  ]);

  return [...voluntary, ...zakat, ...interest];
};

export const getTotalDonationsAggregated = async (
  calendarYearId: string,
): Promise<number> => {
  const payments = await getDonationPaymentsAggregated(calendarYearId);
  return payments.reduce((sum, p) => sum + p.amount, 0);
};

export const getDonationTotalsByCategoryAggregated = async (
  calendarYearId: string,
): Promise<{
  voluntaryTotal: number;
  deductibleTotal: number;
  nonDeductibleTotal: number;
}> => {
  const voluntary = await getVoluntaryDonations(calendarYearId);

  let voluntaryTotal = 0;
  let deductibleTotal = 0;
  let nonDeductibleTotal = 0;

  for (const payment of voluntary) {
    voluntaryTotal += payment.amount;
    if (payment.isDeductible) deductibleTotal += payment.amount;
    else nonDeductibleTotal += payment.amount;
  }

  return {
    voluntaryTotal,
    deductibleTotal,
    nonDeductibleTotal,
  };
};

export const getDonationTotalsByBeneficiaryAggregated = async (
  calendarYearId: string,
): Promise<Array<{ id: string; name: string; total: number }>> => {
  const [voluntary, zakat] = await Promise.all([
    prisma.voluntaryDonation.findMany({
      where: { donationLedger: { calendarId: calendarYearId } },
      select: {
        amount: true,
        business: { select: { id: true, name: true } },
        individual: { select: { id: true, name: true } },
      },
    }),
    prisma.zakatPayment.findMany({
      where: { zakatObligation: { calendarId: calendarYearId } },
      select: {
        amount: true,
        business: { select: { id: true, name: true } },
        individual: { select: { id: true, name: true } },
      },
    }),
  ]);

  const beneficiaryTotals: Record<
    string,
    { id: string; name: string; total: number }
  > = {};

  [...voluntary, ...zakat].forEach((payment) => {
    const amount = payment.amount.toNumber();
    const entity = payment.business ?? payment.individual;
    const id = entity?.id ?? 'unknown';
    const name = entity?.name ?? 'Unknown';

    if (!beneficiaryTotals[id]) {
      beneficiaryTotals[id] = { id, name, total: 0 };
    }
    beneficiaryTotals[id].total += amount;
  });

  return Object.values(beneficiaryTotals);
};
