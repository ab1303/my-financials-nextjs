'use client';

import { useState, useCallback } from 'react';
import {
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type {
  ClassifiedTransaction,
} from '@/server/services/ai-import/_types';

/**
 * Known Australian brand tokens for merchant detection
 */
const KNOWN_BRAND_TOKENS = new Set([
  'WOOLWORTHS',
  'COLES',
  'ALDI',
  'IGA',
  'HARRIS',
  'NETFLIX',
  'SPOTIFY',
  'DISNEY',
  'STAN',
  'APPLE',
  'AMAZON',
  'UBER',
  'DOORDASH',
  'MENULOG',
  'CHEMIST',
  'PRICELINE',
  'TRANSPORT',
  'OPAL',
  'PAYPAL',
  'GOOGLE',
  'MICROSOFT',
]);

/**
 * Detect if merchant description looks unknown/suspicious
 */
export function isLikelyUnknownMerchant(description: string): boolean {
  const words = description.split(/\s+/).filter(Boolean);
  if (words.length > 4) return false;
  if (description !== description.toUpperCase()) return false;
  return !KNOWN_BRAND_TOKENS.has(words[0]?.toUpperCase() ?? '');
}

/**
 * Month of transactions with usage statistics
 */
export interface ClassifiedMonth {
  month: string; // "YYYY-MM"
  transactions: ClassifiedTransaction[];
  totalUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Component props
 */
export interface TransactionReviewTableProps {
  months: ClassifiedMonth[];
  categories: Array<{ id: string; name: string }>;
  onConfirm: (months: ClassifiedMonth[]) => Promise<void>;
  isConfirming: boolean;
}

export default function TransactionReviewTable({
  months: initialMonths,
  categories,
  onConfirm,
  isConfirming,
}: TransactionReviewTableProps) {
  const [months, setMonths] = useState<ClassifiedMonth[]>(
    initialMonths.map((m) => ({
      ...m,
      transactions: m.transactions.map((t) => ({ ...t })),
    })),
  );
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    new Set(initialMonths.map((m) => m.month)),
  );

  const handleToggleMonth = useCallback((month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) {
        next.delete(month);
      } else {
        next.add(month);
      }
      return next;
    });
  }, []);

  const handleCategoryChange = useCallback(
    (monthIdx: number, txIdx: number, newCategory: string) => {
      setMonths((prev) => {
        const next = [...prev];
        const month = next[monthIdx];
        if (!month) return prev;

        const tx = month.transactions[txIdx];
        if (!tx) return prev;

        const updated = { ...tx };
        updated.confirmedCategory = newCategory;
        updated.overridden = newCategory !== updated.llmCategory;

        const updatedTransactions = [...month.transactions];
        updatedTransactions[txIdx] = updated;

        next[monthIdx] = { ...month, transactions: updatedTransactions };
        return next;
      });
    },
    [],
  );

  const handleAcceptAll = useCallback(() => {
    setMonths((prev) =>
      prev.map((m) => ({
        ...m,
        transactions: m.transactions.map((t) => ({
          ...t,
          confirmedCategory: t.llmCategory,
          overridden: false,
        })),
      })),
    );
  }, []);

  const handleConfirm = useCallback(async () => {
    await onConfirm(months);
  }, [months, onConfirm]);

  // Count total overrides
  const totalOverrides = months.reduce(
    (sum, m) => sum + m.transactions.filter((t) => t.overridden).length,
    0,
  );

  // Calculate total usage
  const totalUsage = {
    promptTokens: months.reduce((sum, m) => sum + m.totalUsage.promptTokens, 0),
    completionTokens: months.reduce(
      (sum, m) => sum + m.totalUsage.completionTokens,
      0,
    ),
    totalTokens: months.reduce((sum, m) => sum + m.totalUsage.totalTokens, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Review Classifications
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {months.reduce((sum, m) => sum + m.transactions.length, 0)} transactions • {totalOverrides} changes applied
          </p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p>Tokens: {totalUsage.totalTokens}</p>
        </div>
      </div>

      {/* Month sections */}
      <div className="space-y-4">
        {months.map((month, monthIdx) => (
          <div key={month.month} className="border rounded-lg overflow-hidden">
            {/* Month header */}
            <button
              onClick={() => handleToggleMonth(month.month)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                {expandedMonths.has(month.month) ? (
                  <ChevronUp className="h-4 w-4 text-gray-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-600" />
                )}
                <span className="font-medium text-gray-900">
                  {month.month}
                </span>
                <span className="text-sm text-gray-600">
                  ({month.transactions.length} transactions)
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {month.transactions.filter((t) => t.overridden).length} changes
              </span>
            </button>

            {/* Month content */}
            {expandedMonths.has(month.month) && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">
                        Date
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">
                        Description
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">
                        Amount
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">
                        LLM Suggested
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">
                        Your Category
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {month.transactions.map((tx, txIdx) => (
                      <tr
                        key={tx.id}
                        className={`border-b transition-colors ${
                          tx.overridden
                            ? 'bg-amber-50 hover:bg-amber-100'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(tx.date).toLocaleDateString('en-AU')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="flex items-center space-x-2">
                            {isLikelyUnknownMerchant(tx.description) && (
                              <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                            )}
                            <span className="font-medium">
                              {tx.description}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">
                          ${tx.amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {tx.llmCategory}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <select
                            value={tx.confirmedCategory}
                            onChange={(e) =>
                              handleCategoryChange(
                                monthIdx,
                                txIdx,
                                e.target.value,
                              )
                            }
                            className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-0 bg-white text-sm"
                          >
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.name}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-4 border-t">
        <button
          onClick={handleAcceptAll}
          disabled={isConfirming}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Accept All
        </button>

        <button
          onClick={handleConfirm}
          disabled={isConfirming}
          className="flex items-center space-x-2 px-6 py-2 bg-teal-600 text-white rounded font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConfirming && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>{isConfirming ? 'Saving...' : 'Confirm & Save'}</span>
        </button>
      </div>
    </div>
  );
}
