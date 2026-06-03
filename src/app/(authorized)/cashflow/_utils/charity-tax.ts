import type { DonationPurposeEnum } from '@prisma/client';
type DonationPaymentLike = {
  amount: number;
  donationPurpose?: DonationPurposeEnum;
  isDeductible?: boolean;
};

type ZakatPaymentLike = {
  amount: number;
  isDeductible?: boolean;
};

/**
 * Converts deductibility to a human-readable label for display.
 * Used throughout the UI to show tax deductibility status.
 *
 * @param isDeductible - Whether the payment is deductible
 * @returns Display label for deductibility
 */
export function getTaxCategoryLabel(isDeductible: boolean): string {
  return isDeductible ? 'Deductible (DGR)' : 'Non-Deductible';
}

/**
 * Converts a donation purpose enum value to a human-readable label for display.
 * Used in table columns and form labels.
 *
 * @param purpose - The donation purpose enum value
 * @returns Display label for the donation purpose
 */
export function getDonationPurposeLabel(purpose: DonationPurposeEnum): string {
  const labelMap: Record<DonationPurposeEnum, string> = {
    VOLUNTARY: 'Voluntary',
    INTEREST_CLEANSING: 'Interest Cleansing',
    ZAKAT: 'Zakat',
  };

  return labelMap[purpose] ?? purpose;
}

/**
 * Breakdown totals for donations with purpose and deductibility breakdown.
 */
export type DonationBreakdownTotals = {
  voluntaryDeductible: number;
  voluntaryNonDeductible: number;
  interestCleansingDeductible: number;
  interestCleansingNonDeductible: number;
  totalDeductible: number;
  totalNonDeductible: number;
  total: number;
};

/**
 * Breakdown totals for zakat with only deductibility breakdown.
 */
export type ZakatBreakdownTotals = {
  totalDeductible: number;
  totalNonDeductible: number;
  total: number;
};

/**
 * Calculates breakdown totals for donations and zakat payments.
 * Breaks down totals by purpose (for donations) and by deductibility (for both).
 *
 * For donations, returns totals broken down by:
 * - Voluntary donations (deductible and non-deductible)
 * - Interest cleansing donations (deductible and non-deductible)
 * - Overall totals by deductibility and total
 *
 * For zakat, returns totals broken down by:
 * - Deductible and non-deductible only
 * - Overall total
 *
 * @param type - Either 'donation' or 'zakat' to determine breakdown structure
 * @param payments - Array of payment records to sum up
 * @returns Breakdown totals object with appropriate structure for the type
 */
export function calculateBreakdownTotals(
  type: 'donation',
  payments: DonationPaymentLike[],
): DonationBreakdownTotals;
export function calculateBreakdownTotals(
  type: 'zakat',
  payments: ZakatPaymentLike[],
): ZakatBreakdownTotals;
export function calculateBreakdownTotals(
  type: 'donation' | 'zakat',
  payments: DonationPaymentLike[] | ZakatPaymentLike[],
): DonationBreakdownTotals | ZakatBreakdownTotals {
  if (type === 'donation') {
    const donationPayments = payments as DonationPaymentLike[];

    let voluntaryDeductible = 0;
    let voluntaryNonDeductible = 0;
    let interestCleansingDeductible = 0;
    let interestCleansingNonDeductible = 0;

    for (const payment of donationPayments) {
      const purpose = payment.donationPurpose ?? 'VOLUNTARY';
      const isDeductible = payment.isDeductible === true;

      if (purpose === 'VOLUNTARY') {
        if (isDeductible) {
          voluntaryDeductible += payment.amount;
        } else {
          voluntaryNonDeductible += payment.amount;
        }
      } else if (purpose === 'INTEREST_CLEANSING') {
        if (isDeductible) {
          interestCleansingDeductible += payment.amount;
        } else {
          interestCleansingNonDeductible += payment.amount;
        }
      }
    }

    const totalDeductible = voluntaryDeductible + interestCleansingDeductible;
    const totalNonDeductible = voluntaryNonDeductible + interestCleansingNonDeductible;
    const total = totalDeductible + totalNonDeductible;

    return {
      voluntaryDeductible,
      voluntaryNonDeductible,
      interestCleansingDeductible,
      interestCleansingNonDeductible,
      totalDeductible,
      totalNonDeductible,
      total,
    };
  } else {
    // Zakat breakdown
    const zakatPayments = payments as ZakatPaymentLike[];

    let totalDeductible = 0;
    let totalNonDeductible = 0;

    for (const payment of zakatPayments) {
      const isDeductible = payment.isDeductible === true;

      if (isDeductible) {
        totalDeductible += payment.amount;
      } else {
        totalNonDeductible += payment.amount;
      }
    }

    const total = totalDeductible + totalNonDeductible;

    return {
      totalDeductible,
      totalNonDeductible,
      total,
    };
  }
}
