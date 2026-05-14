'use client';

import type { TransactionRow as LedgerTransactionRow } from '@/server/trpc/router/transaction-ledger';

interface ReimbursementSubRowProps {
  reimbursement: LedgerTransactionRow;
  colCount: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
}

export default function ReimbursementSubRow({ reimbursement, colCount }: ReimbursementSubRowProps) {
  return (
    <tr className="border-b border-teal-100 bg-teal-50/50 dark:border-teal-900/30 dark:bg-teal-950/20">
      <td className="w-8" />
      <td className="py-2 pl-6 text-sm text-gray-500 dark:text-gray-400">{reimbursement.date.slice(0, 10)}</td>
      <td className="max-w-[220px] px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
        <div className="flex items-center gap-1">
          <span className="shrink-0 text-teal-500">↩</span>
          <span className="truncate" title={reimbursement.description}>
            {reimbursement.description}
          </span>
        </div>
      </td>
      <td className="px-4 py-2 text-sm font-medium tabular-nums text-teal-600 dark:text-teal-400">
        {formatCurrency(reimbursement.amount)}
      </td>
      <td colSpan={colCount - 4} className="px-4 py-2 text-xs text-teal-600 dark:text-teal-400">
        offsets {reimbursement.offsetCategory ?? '—'}
      </td>
    </tr>
  );
}
