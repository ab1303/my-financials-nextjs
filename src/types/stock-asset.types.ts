import type {
  StockSnapshot,
  StockHolding,
  Business,
  CurrencyEnumType,
  InvestmentTermEnumType,
} from '@prisma/client';

// ── Extended Prisma Types (with relations) ───────────────────────

export type StockHoldingWithAccount = StockHolding & {
  account: Pick<Business, 'id' | 'name'>;
};

export type StockSnapshotWithHoldings = StockSnapshot & {
  holdings: StockHoldingWithAccount[];
};

// ── Computed/Display Types ───────────────────────────────────────

export type HoldingCalculations = {
  remainingQuantity: number; // quantity - (soldQuantity ?? 0)
  costBasis: number; // buyPrice × quantity
  marketValue: number; // currentPrice × remainingQuantity
  unrealizedPL: number; // (currentPrice - buyPrice) × remainingQuantity
  unrealizedPLPercent: number; // unrealizedPL / (buyPrice × remainingQuantity) × 100
  realizedPL: number; // (salePrice - buyPrice) × soldQuantity (if sold)
  holdingPeriodMonths: number; // months from buyDate to snapshotDate/saleDate
  isCGTEligible: boolean; // holdingPeriodMonths >= 12 (at saleDate)
  isSold: boolean; // soldQuantity > 0
  isFullySold: boolean; // soldQuantity === quantity
  termStatus: TermStatus; // ON_TRACK | AHEAD | BEHIND
};

export type TermStatus = 'ON_TRACK' | 'AHEAD' | 'BEHIND';

export type HoldingDisplay = StockHoldingWithAccount & HoldingCalculations;

// ── Aggregated Types ─────────────────────────────────────────────

export type AccountTotalSummary = {
  accountId: string;
  accountName: string;
  currency: CurrencyEnumType;
  holdings: HoldingDisplay[];
  totalMarketValue: number;
  totalUnrealizedPL: number;
  totalRealizedPL: number;
};

export type CurrencyTotal = {
  currency: CurrencyEnumType;
  totalMarketValue: number;
  totalUnrealizedPL: number;
  totalRealizedPL: number;
};

export type StockSnapshotTotals = {
  snapshotId: string;
  snapshotDate: Date;
  accounts: AccountTotalSummary[];
  currencyTotals: CurrencyTotal[];
};

// ── Form Types ───────────────────────────────────────────────────

export type HoldingFormData = {
  ticker: string;
  companyName: string;
  quantity: number;
  buyPrice: number;
  buyDate: Date;
  currentPrice: number;
  currency: CurrencyEnumType;
  plannedTerm: InvestmentTermEnumType;
  accountId: string;
  salePrice?: number | null;
  saleDate?: Date | null;
  soldQuantity?: number | null;
};

export type SnapshotFormData = {
  snapshotDate: Date;
  holdings: HoldingFormData[];
};

// ── Select Options ───────────────────────────────────────────────

export type BrokerageAccountOption = {
  value: string; // Business.id
  label: string; // Business.name
};

export type CurrencyOption = {
  value: CurrencyEnumType;
  label: string;
};

export type InvestmentTermOption = {
  value: InvestmentTermEnumType;
  label: string;
};

// ── Calendar Year (shared, re-exported for convenience) ──────────

export type CalendarType = 'FISCAL' | 'ANNUAL' | 'ZAKAT';
