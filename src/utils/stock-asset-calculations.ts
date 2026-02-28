import { differenceInMonths, addMonths } from 'date-fns';
import type {
  StockHoldingWithAccount,
  HoldingCalculations,
  TermStatus,
} from '@/types/stock-asset.types';
import type { InvestmentTermEnumType, CurrencyEnumType } from '@prisma/client';

/**
 * Calculate all derived metrics for a single holding.
 * Used to populate the HoldingDisplay type and table columns.
 */
export function calculateHoldingMetrics(
  holding: StockHoldingWithAccount,
  snapshotDate: Date,
): HoldingCalculations {
  const qty = Number(holding.quantity);
  const soldQty = holding.soldQuantity ? Number(holding.soldQuantity) : 0;
  const remainingQty = qty - soldQty;
  const buyPrice = Number(holding.buyPrice);
  const currentPrice = Number(holding.currentPrice);

  // Core calculations
  const costBasis = buyPrice * qty;
  const marketValue = remainingQty * currentPrice;
  const unrealizedPL =
    remainingQty > 0 ? (currentPrice - buyPrice) * remainingQty : 0;
  const unrealizedPLPercent =
    remainingQty > 0 && buyPrice > 0
      ? ((currentPrice - buyPrice) / buyPrice) * 100
      : 0;

  // Realized P/L
  const salePrice = holding.salePrice ? Number(holding.salePrice) : 0;
  const realizedPL = soldQty > 0 ? (salePrice - buyPrice) * soldQty : 0;

  // Holding period (months from buy to sale or snapshot date)
  const endDate = holding.saleDate ?? snapshotDate;
  const holdingPeriodMonths = differenceInMonths(endDate, holding.buyDate);

  // CGT eligibility (Australian tax - 12 month threshold)
  // Only relevant for sold holdings to determine if capital gains discount applies
  const isCGTEligible = soldQty > 0 && holdingPeriodMonths >= 12;

  // Sale status
  const isSold = soldQty > 0;
  const isFullySold = soldQty >= qty;

  // Compare planned term vs actual holding period
  const termStatus = calculateTermStatus(
    holding.plannedTerm,
    holdingPeriodMonths,
    isSold,
  );

  return {
    remainingQuantity: remainingQty,
    costBasis,
    marketValue,
    unrealizedPL,
    unrealizedPLPercent,
    realizedPL,
    holdingPeriodMonths,
    isCGTEligible,
    isSold,
    isFullySold,
    termStatus,
  };
}

/**
 * Determine if a holding is ON_TRACK, AHEAD, or BEHIND its planned investment term.
 *
 * - SHORT_TERM: 0-11 months
 * - MID_TERM: 12-36 months
 * - LONG_TERM: 37+ months
 *
 * For sold holdings: actual holding must match planned range.
 * For unsold holdings: check if still within planned range.
 */
function calculateTermStatus(
  plannedTerm: InvestmentTermEnumType,
  actualMonths: number,
  isSold: boolean,
): TermStatus {
  const termThresholds: Record<
    InvestmentTermEnumType,
    { min: number; max: number }
  > = {
    SHORT_TERM: { min: 0, max: 11 },
    MID_TERM: { min: 12, max: 36 },
    LONG_TERM: { min: 37, max: Infinity },
  };

  const planned = termThresholds[plannedTerm];

  if (isSold) {
    // For sold stocks: compare actual holding to planned range
    if (actualMonths >= planned.min && actualMonths <= planned.max) {
      return 'ON_TRACK';
    }
    if (actualMonths > planned.max) {
      return 'AHEAD'; // Held longer than planned
    }
    return 'BEHIND'; // Sold earlier than planned
  }

  // For unsold stocks: are they on track to meet the planned term?
  if (actualMonths <= planned.max) {
    return 'ON_TRACK';
  }
  return 'AHEAD'; // Held longer than planned category
}

/**
 * Get the projected date when a holding becomes CGT eligible (12 months from purchase).
 * Only used for unsold holdings to show user when they'll be eligible for capital gains discount.
 */
export function getProjectedCGTDate(buyDate: Date): Date {
  return addMonths(buyDate, 12);
}

/**
 * Generate human-readable text for CGT eligibility status.
 * Used for tooltips/help text on unsold holdings.
 */
export function getCGTProjectionText(
  buyDate: Date,
  snapshotDate: Date,
): string {
  const eligibleDate = getProjectedCGTDate(buyDate);
  if (snapshotDate >= eligibleDate) {
    return 'Eligible now';
  }
  const monthsRemaining = differenceInMonths(eligibleDate, snapshotDate);
  return `${monthsRemaining} month${monthsRemaining === 1 ? '' : 's'} to CGT discount`;
}

/**
 * Format a number as currency with appropriate symbol and decimals.
 * Uses Australian locale with specified currency code (AUD, USD, etc.).
 */
export function formatCurrency(
  value: number,
  currency: CurrencyEnumType,
): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a profit/loss value as currency with +/- prefix.
 * Positive values get '+', negative values get '-' (already included).
 */
export function formatPL(value: number, currency: CurrencyEnumType): string {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${formatCurrency(value, currency)}`;
}

/**
 * Format holding period in months as human-readable text.
 * Examples: "5 mo", "1 yr", "2 yr, 3 mo"
 */
export function formatHoldingPeriod(months: number): string {
  if (months < 12) {
    return `${months} mo`;
  }
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (remainingMonths === 0) {
    return years === 1 ? '1 yr' : `${years} yr`;
  }
  return `${years} yr, ${remainingMonths} mo`;
}

/**
 * Format a quantity with appropriate decimal places.
 * Shows whole numbers without decimals, fractional numbers with up to 4 decimals.
 */
export function formatQuantity(qty: number): string {
  // Show decimals only if fractional
  if (qty % 1 === 0) {
    return qty.toString();
  }
  return qty.toFixed(4);
}

/**
 * Format a price/cost value as currency.
 * Used for buy price, current price, sale price in tables.
 */
export function formatPrice(value: number, currency: CurrencyEnumType): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4, // Allow more precision for prices
  }).format(value);
}

/**
 * Format a percentage value with +/- prefix and 2 decimal places.
 * Examples: "+15.50%", "-3.25%"
 */
export function formatPercentage(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
}

/**
 * Get a color class for Tailwind styling based on P/L value.
 * Returns 'text-green-600' for positive, 'text-red-600' for negative.
 */
export function getPLColorClass(value: number): string {
  if (value > 0) return 'text-green-600';
  if (value < 0) return 'text-red-600';
  return 'text-gray-600';
}

/**
 * Get a background color class for P/L cell highlighting.
 * Used for table cell backgrounds to make gains/losses more visible.
 */
export function getPLBgColorClass(value: number): string {
  if (value > 0) return 'bg-green-50';
  if (value < 0) return 'bg-red-50';
  return 'bg-gray-50';
}

/**
 * Get a color class for term status badges.
 * ON_TRACK: blue, AHEAD: green, BEHIND: amber
 */
export function getTermStatusColorClass(termStatus: TermStatus): string {
  switch (termStatus) {
    case 'ON_TRACK':
      return 'bg-blue-100 text-blue-800';
    case 'AHEAD':
      return 'bg-green-100 text-green-800';
    case 'BEHIND':
      return 'bg-amber-100 text-amber-800';
  }
}

/**
 * Get a human-readable label for term status.
 */
export function getTermStatusLabel(termStatus: TermStatus): string {
  switch (termStatus) {
    case 'ON_TRACK':
      return 'On Track';
    case 'AHEAD':
      return 'Ahead';
    case 'BEHIND':
      return 'Behind';
  }
}
