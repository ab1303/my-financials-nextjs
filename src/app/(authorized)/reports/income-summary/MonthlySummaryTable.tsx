'use client';

import { useState } from 'react';
import type {
  MonthlyIncomeSummary,
  SourceBreakdown,
} from '@/server/models/income';
import { NumericFormat } from 'react-number-format';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa';
import SourceBreakdownRow from './SourceBreakdownRow';

type MonthlySummaryTableProps = {
  monthlySummary: MonthlyIncomeSummary[];
  calendarYearId: string;
  userId: string;
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function MonthlySummaryTable({
  monthlySummary,
  calendarYearId,
  userId,
}: MonthlySummaryTableProps) {
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [sourceBreakdowns, setSourceBreakdowns] = useState<
    Map<string, SourceBreakdown[]>
  >(new Map());
  const [loadingBreakdowns, setLoadingBreakdowns] = useState<Set<string>>(
    new Set(),
  );

  const toggleMonth = async (month: number, year: number) => {
    const key = `${year}-${month}`;
    const newExpanded = new Set(expandedMonths);

    if (expandedMonths.has(key)) {
      // Collapse
      newExpanded.delete(key);
      setExpandedMonths(newExpanded);
    } else {
      // Expand and fetch breakdown if not already loaded
      newExpanded.add(key);
      setExpandedMonths(newExpanded);

      if (!sourceBreakdowns.has(key)) {
        setLoadingBreakdowns(new Set(loadingBreakdowns).add(key));
        try {
          const response = await fetch(
            `/api/income/source-breakdown?calendarYearId=${calendarYearId}&month=${month}&year=${year}&userId=${userId}`,
          );
          if (response.ok) {
            const data = (await response.json()) as SourceBreakdown[];
            setSourceBreakdowns(new Map(sourceBreakdowns).set(key, data));
          }
        } catch (error) {
          console.error('Failed to fetch source breakdown:', error);
        } finally {
          const newLoading = new Set(loadingBreakdowns);
          newLoading.delete(key);
          setLoadingBreakdowns(newLoading);
        }
      }
    }
  };

  if (monthlySummary.length === 0) {
    return (
      <div className='rounded-lg border bg-white p-8 text-center'>
        <p className='text-gray-500'>
          No income data recorded for this fiscal year.
        </p>
      </div>
    );
  }

  return (
    <div className='overflow-hidden rounded-lg border bg-white shadow'>
      <table className='min-w-full divide-y divide-gray-200'>
        <thead className='bg-gray-50'>
          <tr>
            <th className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
              {/* Expand icon column */}
            </th>
            <th className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
              Month / Year
            </th>
            <th className='px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500'>
              Total Income
            </th>
            <th className='px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500'>
              Entries
            </th>
          </tr>
        </thead>
        <tbody className='divide-y divide-gray-200 bg-white'>
          {monthlySummary.map((summary) => {
            const key = `${summary.year}-${summary.month}`;
            const isExpanded = expandedMonths.has(key);
            const breakdown = sourceBreakdowns.get(key);
            const isLoading = loadingBreakdowns.has(key);

            return (
              <>
                <tr
                  key={key}
                  className='cursor-pointer hover:bg-gray-50'
                  onClick={() => void toggleMonth(summary.month, summary.year)}
                >
                  <td className='px-6 py-4'>
                    {isExpanded ? (
                      <FaChevronDown className='h-4 w-4 text-gray-400' />
                    ) : (
                      <FaChevronRight className='h-4 w-4 text-gray-400' />
                    )}
                  </td>
                  <td className='whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900'>
                    {MONTH_NAMES[summary.month - 1]} {summary.year}
                  </td>
                  <td className='whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900'>
                    <NumericFormat
                      value={summary.totalAmount}
                      displayType='text'
                      thousandSeparator
                      prefix='$'
                      decimalScale={2}
                      fixedDecimalScale
                    />
                  </td>
                  <td className='whitespace-nowrap px-6 py-4 text-center text-sm text-gray-500'>
                    {summary.entryCount}
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={4} className='bg-gray-50 px-12 py-4'>
                      {isLoading && (
                        <div className='py-4 text-center text-sm text-gray-500'>
                          Loading source breakdown...
                        </div>
                      )}
                      {!isLoading && breakdown && (
                        <SourceBreakdownRow breakdown={breakdown} />
                      )}
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
