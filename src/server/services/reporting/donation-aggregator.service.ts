import { getInterestCleansingPayments } from '../interest-cleansing/interest-cleansing.service';
import {
  getVoluntaryDonations,
  getVoluntaryDonationTotalsByBeneficiary,
} from '../voluntary-donations/voluntary-donation.service';
import {
  getZakatPayments,
  getZakatTotalsByBeneficiary,
} from '../zakat/zakat.service';

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
    getVoluntaryDonationTotalsByBeneficiary(calendarYearId),
    getZakatTotalsByBeneficiary(calendarYearId),
  ]);

  const beneficiaryTotals: Record<
    string,
    { id: string; name: string; total: number }
  > = {};

  [...voluntary, ...zakat].forEach((b) => {
    let existing = beneficiaryTotals[b.id];
    if (!existing) {
      existing = { id: b.id, name: b.name, total: 0 };
      beneficiaryTotals[b.id] = existing;
    }
    existing.total += b.total;
  });

  return Object.values(beneficiaryTotals);
};
