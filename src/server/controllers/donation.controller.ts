import {
  addDonationCalendarYearDetails,
  getDonation,
} from '../services/donation-ledger.service';
import {
  getDonationPaymentsAggregated,
  getDonationTotalsByCategoryAggregated,
  getDonationTotalsByBeneficiaryAggregated,
  getTotalDonationsAggregated,
} from '../services/reporting/donation-aggregator.service';
import { handleCaughtError } from '../utils/prisma';

export const createDonationYearHandler = async (
  donationCalendarYearId: string,
) => {
  try {
    const donation = await getDonation(donationCalendarYearId);
    if (!!donation.id) return { donationCalendarId: donation.id };

    const donationCalendarYear = await addDonationCalendarYearDetails({
      calendarId: donationCalendarYearId,
    });

    return { donationCalendarId: donationCalendarYear.id };
  } catch (e) {
    handleCaughtError(e);

    return { donationCalendarId: '' };
  }
};

export const donationPaymentsHandler = async (calendarYearId: string, beneficiaryId?: string) => {
  try {
    const donationPayments = await getDonationPaymentsAggregated(calendarYearId, beneficiaryId);
    return donationPayments;
  } catch (e) {
    handleCaughtError(e);
  }
};

export const donationHandler = async (calendarYearId: string) => {
  try {
    const donation = await getDonation(calendarYearId);
    return donation;
  } catch (e) {
    handleCaughtError(e);
  }
};

export const totalDonationsHandler = async (calendarYearId: string) => {
  try {
    const totalDonations = await getTotalDonationsAggregated(calendarYearId);
    return totalDonations;
  } catch (e) {
    handleCaughtError(e);
    return 0;
  }
};

/**
 * Handler that returns donation totals broken down by purpose and deductible status.
 * Used for displaying comprehensive donation reporting metrics.
 */
export const donationTotalsByCategoryHandler = async (
  calendarYearId: string,
) => {
  try {
    const totals = await getDonationTotalsByCategoryAggregated(calendarYearId);
    return totals;
  } catch (e) {
    handleCaughtError(e);
    return {
      voluntaryTotal: 0,
      deductibleTotal: 0,
      nonDeductibleTotal: 0,
    };
  }
};

/**
 * Handler that returns donation totals broken down by beneficiary.
 */
export const donationTotalsByBeneficiaryHandler = async (
  calendarYearId: string,
) => {
  try {
    const totals = await getDonationTotalsByBeneficiaryAggregated(calendarYearId);
    return totals;
  } catch (e) {
    handleCaughtError(e);
    return [];
  }
};

