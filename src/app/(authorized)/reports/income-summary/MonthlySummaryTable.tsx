'use client';

import { Fragment, useState, useMemo, useCallback } from 'react';
import type {
  MonthlyIncomeSummary,
  SourceBreakdown,
} from '@/server/models/income';
import { NumericFormat } from 'react-number-format';
import { ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import SourceBreakdownRow from './SourceBreakdownRow';

type SortField = 'totalAmount' | 'entryCount';
type SortOrder = 'asc' | 'desc';

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
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setSortOrder('desc');
      return field;
    });
  }, []);

  const sortedSummary = useMemo(() => {
    if (!sortField) return monthlySummary;
    return [...monthlySummary].sort((a, b) => {
      const diff = a[sortField] - b[sortField];
      return sortOrder === 'asc' ? diff : -diff;
    });
  }, [monthlySummary, sortField, sortOrder]);

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
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
              errorData.error || 'Failed to fetch source breakdown',
            );
          }
          const data = (await response.json()) as SourceBreakdown[];
          setSourceBreakdowns(new Map(sourceBreakdowns).set(key, data));
        } catch (error) {
          console.error('Failed to fetch source breakdown:', error);
          // Set empty array so user knows there was an attempt to load
          setSourceBreakdowns(new Map(sourceBreakdowns).set(key, []));
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
      <div className='rounded-lg border bg-card p-8 text-center'>
        <p className='text-muted-foreground'>
          No income data recorded for this fiscal year.
        </p>
      </div>
    );
  }

  return (
    <div className='overflow-hidden rounded-lg border bg-card shadow'>
      <table className='min-w-full divide-y divide-border'>
        <thead className='bg-muted'>
          <tr>
            <th className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground'>
              {/* Expand icon column */}
            </th>
            <th className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground'>
              Month / Year
            </th>
            <th className='px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground'>
              <button
                onClick={() => handleSort('totalAmount')}
                className='inline-flex items-center gap-1 hover:text-foreground transition-colors'
              >
                Total Income
                {sortField === 'totalAmount' ? (
                  sortOrder === 'asc' ? <ArrowUp className='h-3 w-3' /> : <ArrowDown className='h-3 w-3' />
                ) : (
                  <ArrowUpDown className='h-3 w-3 opacity-40' />
                )}
              </button>
            </th>
            <th className='px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground'>
              <button
                onClick={() => handleSort('entryCount')}
                className='inline-flex items-center gap-1 hover:text-foreground transition-colors'
              >
                Entries
                {sortField === 'entryCount' ? (
                  sortOrder === 'asc' ? <ArrowUp className='h-3 w-3' /> : <ArrowDown className='h-3 w-3' />
                ) : (
                  <ArrowUpDown className='h-3 w-3 opacity-40' />
                )}
              </button>
            </th>
          </tr>
        </thead>
        <tbody className='divide-y divide-border bg-card'>
          {sortedSummary.map((summary) => {
            const key = `${summary.year}-${summary.month}`;
            const isExpanded = expandedMonths.has(key);
            const breakdown = sourceBreakdowns.get(key);
            const isLoading = loadingBreakdowns.has(key);

            return (
              <Fragment key={key}>
                <tr
                  className='cursor-pointer hover:bg-muted/50'
                  onClick={() => void toggleMonth(summary.month, summary.year)}
                >
                  <td className='px-6 py-4'>
                    {isExpanded ? (
                      <ChevronDown className='h-4 w-4 text-muted-foreground' />
                    ) : (
                      <ChevronRight className='h-4 w-4 text-muted-foreground' />
                    )}
                  </td>
                  <td className='whitespace-nowrap px-6 py-4 text-sm font-medium text-foreground'>
                    {MONTH_NAMES[summary.month - 1]} {summary.year}
                  </td>
                  <td className='whitespace-nowrap px-6 py-4 text-right text-sm text-foreground'>
                    <NumericFormat
                      value={summary.totalAmount}
                      displayType='text'
                      thousandSeparator
                      prefix='$'
                      decimalScale={2}
                      fixedDecimalScale
                    />
                  </td>
                  <td className='whitespace-nowrap px-6 py-4 text-center text-sm text-muted-foreground'>
                    {summary.entryCount}
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={4} className='bg-muted/50 px-12 py-4'>
                      {isLoading && (
                        <div className='py-4 text-center text-sm text-muted-foreground'>
                          Loading source breakdown...
                        </div>
                      )}
                      {!isLoading && breakdown && (
                        <SourceBreakdownRow breakdown={breakdown} />
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
