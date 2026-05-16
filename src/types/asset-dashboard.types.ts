export interface NetWorthDataPoint {
  date: string;
  cashTotal: number;
  stockTotal: number;
  netWorthTotal: number;
  cashSnapshotId: string;
  stockSnapshotId: string | null;
  isStockStale: boolean;
}

export interface NetWorthTrendFilters {
  fromDate?: Date;
  toDate?: Date;
  calendarYearId?: string;
}

export interface NetWorthTrendResponse {
  dataPoints: NetWorthDataPoint[];
  latestCashTotal: number;
  latestStockTotal: number;
  latestNetWorth: number;
  latestCashDate: string | null;
  latestStockDate: string | null;
}
