'use client';

import { ArrowDownLeft, ArrowUpRight, Zap } from 'lucide-react';
import { NumericFormat } from 'react-number-format';

interface TransactionSummaryProps {
  totalDebitAmount: number;
  totalCreditAmount: number;
}

export default function TransactionSummary({ totalDebitAmount, totalCreditAmount }: TransactionSummaryProps) {
  const net = totalCreditAmount - totalDebitAmount;

  if (totalDebitAmount === 0 && totalCreditAmount === 0) {
    return null;
  }

  return (
    <div className="mb-4 grid grid-cols-3 gap-3 rounded-lg border border-gray-200 bg-gradient-to-r from-gray-50 to-white p-4 dark:border-gray-700 dark:from-gray-800/50 dark:to-gray-900/50">
      {/* Debits */}
      <div className="flex items-center gap-3 rounded-md border border-red-100 bg-red-50/50 px-3 py-2 dark:border-red-900/30 dark:bg-red-950/20">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-red-100 dark:bg-red-900/40">
          <ArrowDownLeft className="h-4 w-4 text-red-600 dark:text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Expenses</p>
          <p className="truncate text-sm font-semibold text-red-700 dark:text-red-300">
            <NumericFormat prefix="$" displayType="text" thousandSeparator value={totalDebitAmount.toFixed(2)} />
          </p>
        </div>
      </div>

      {/* Credits */}
      <div className="flex items-center gap-3 rounded-md border border-green-100 bg-green-50/50 px-3 py-2 dark:border-green-900/30 dark:bg-green-950/20">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-green-100 dark:bg-green-900/40">
          <ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Income</p>
          <p className="truncate text-sm font-semibold text-green-700 dark:text-green-300">
            <NumericFormat prefix="$" displayType="text" thousandSeparator value={totalCreditAmount.toFixed(2)} />
          </p>
        </div>
      </div>

      {/* Net */}
      <div
        className={`flex items-center gap-3 rounded-md border px-3 py-2 ${
          net >= 0
            ? 'border-blue-100 bg-blue-50/50 dark:border-blue-900/30 dark:bg-blue-950/20'
            : 'border-amber-100 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20'
        }`}
      >
        <div className={`flex h-8 w-8 items-center justify-center rounded ${
          net >= 0
            ? 'bg-blue-100 dark:bg-blue-900/40'
            : 'bg-amber-100 dark:bg-amber-900/40'
        }`}>
          <Zap className={`h-4 w-4 ${
            net >= 0
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-amber-600 dark:text-amber-400'
          }`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Net</p>
          <p className={`truncate text-sm font-semibold ${
            net >= 0
              ? 'text-blue-700 dark:text-blue-300'
              : 'text-amber-700 dark:text-amber-300'
          }`}>
            <NumericFormat prefix="$" displayType="text" thousandSeparator value={Math.abs(net).toFixed(2)} />
          </p>
        </div>
      </div>
    </div>
  );
}
