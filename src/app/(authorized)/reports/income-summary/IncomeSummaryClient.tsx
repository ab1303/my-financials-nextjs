'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CalendarEnumType } from '@prisma/client';
import type { MonthlyIncomeSummary } from '@/server/models/income';
import { Label } from '@/components/ui/Label';
import Select from 'react-select';
import { NumericFormat } from 'react-number-format';
import MonthlySummaryTable from './MonthlySummaryTable';

type FiscalYearType = {
  id: string;
  description: string;
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
  type: CalendarEnumType | null;
};

type OptionType = {
  label: string;
  value: string;
};

type IncomeSummaryClientProps = {
  fiscalYears: FiscalYearType[];
  userId: string;
  initialCalendarYearId?: string;
};

export default function IncomeSummaryClient({
  fiscalYears,
  userId,
  initialCalendarYearId,
}: IncomeSummaryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedYearId, setSelectedYearId] = useState<string | null>(
    initialCalendarYearId || null,
  );
  const [monthlySummary, setMonthlySummary] = useState<MonthlyIncomeSummary[]>(
    [],
  );
  const [loading, setLoading] = useState(false);

  // Convert fiscal years to select options
  const yearOptions = useMemo<OptionType[]>(() => {
    return fiscalYears.map((year) => ({
      label: year.description,
      value: year.id,
    }));
  }, [fiscalYears]);

  // Auto-select first year if none selected
  useEffect(() => {
    if (!selectedYearId && yearOptions.length > 0) {
      const firstYearId = yearOptions[0]!.value;
      setSelectedYearId(firstYearId);
      router.push(`/reports/income-summary?calendarYearId=${firstYearId}`);
    }
  }, [selectedYearId, yearOptions, router]);

  // Fetch monthly summary when year changes
  useEffect(() => {
    if (!selectedYearId) return;

    const fetchSummary = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/income/monthly-summary?calendarYearId=${selectedYearId}&userId=${userId}`,
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch income summary');
        }
        const data = (await response.json()) as MonthlyIncomeSummary[];
        setMonthlySummary(data);
      } catch (error) {
        console.error('Failed to fetch monthly summary:', error);
        setMonthlySummary([]);
        // Could add toast notification here if toast is imported
        // toast.error('Failed to load income summary. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void fetchSummary();
  }, [selectedYearId, userId]);

  const onYearChange = (option: OptionType | null) => {
    if (!option) return;

    setSelectedYearId(option.value);
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('calendarYearId', option.value);
    router.push(`/reports/income-summary?${params.toString()}`);
  };

  const selectedYear = yearOptions.find((opt) => opt.value === selectedYearId);

  // Calculate total income across all months
  const totalIncome = monthlySummary.reduce(
    (sum, month) => sum + month.totalAmount,
    0,
  );

  // Calculate average monthly income
  const averageIncome =
    monthlySummary.length > 0 ? totalIncome / monthlySummary.length : 0;

  return (
    <div className='space-y-6'>
      {/* Fiscal Year Selection */}
      <div className='w-full md:w-1/2'>
        <Label htmlFor='fiscal-year-select'>Fiscal Year</Label>
        <Select
          id='fiscal-year-select'
          options={yearOptions}
          value={selectedYear}
          onChange={onYearChange}
          placeholder='Select fiscal year...'
          className='mt-1'
        />
      </div>

      {/* Summary Statistics */}
      {selectedYearId && !loading && (
        <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
          <div className='rounded-lg border bg-white p-4 shadow-sm'>
            <h3 className='text-sm font-medium text-gray-500'>Total Income</h3>
            <NumericFormat
              value={totalIncome}
              displayType='text'
              thousandSeparator
              prefix='$'
              decimalScale={2}
              fixedDecimalScale
              className='mt-1 text-2xl font-bold text-gray-900'
            />
          </div>
          <div className='rounded-lg border bg-white p-4 shadow-sm'>
            <h3 className='text-sm font-medium text-gray-500'>
              Average Monthly
            </h3>
            <NumericFormat
              value={averageIncome}
              displayType='text'
              thousandSeparator
              prefix='$'
              decimalScale={2}
              fixedDecimalScale
              className='mt-1 text-2xl font-bold text-gray-900'
            />
          </div>
          <div className='rounded-lg border bg-white p-4 shadow-sm'>
            <h3 className='text-sm font-medium text-gray-500'>
              Months Recorded
            </h3>
            <p className='mt-1 text-2xl font-bold text-gray-900'>
              {monthlySummary.length}
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className='py-8 text-center text-gray-500'>
          Loading monthly summary...
        </div>
      )}

      {/* Monthly Summary Table */}
      {!loading && selectedYearId && (
        <MonthlySummaryTable
          monthlySummary={monthlySummary}
          calendarYearId={selectedYearId}
          userId={userId}
        />
      )}
    </div>
  );
}
