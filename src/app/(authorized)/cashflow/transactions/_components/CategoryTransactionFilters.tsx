'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface CategoryTransactionFiltersProps {
  allCategories: Array<{ id: string; name: string }>;
  initialCategory?: string;
  initialMonth?: number;
  initialYear?: number;
}

function decodeMaybe(value: string | undefined) {
  if (!value) return undefined;

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function CategoryTransactionFilters({
  allCategories,
  initialCategory,
  initialMonth,
  initialYear,
}: CategoryTransactionFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [category, setCategory] = useState<string | undefined>(() => decodeMaybe(initialCategory));
  const [month, setMonth] = useState<number | undefined>(initialMonth);
  const [year, setYear] = useState<number | undefined>(initialYear);

  const searchParamsString = searchParams?.toString() ?? '';
  const currentSearchParams = useMemo(() => new URLSearchParams(searchParamsString), [searchParamsString]);

  const handleCategoryChange = useCallback((value: string) => {
    setCategory(value || undefined);
  }, []);

  const handleMonthChange = useCallback((value: string) => {
    const nextMonth = value ? Number.parseInt(value, 10) : undefined;
    setMonth(nextMonth);
  }, []);

  const handleYearChange = useCallback((value: string) => {
    const nextYear = value ? Number.parseInt(value, 10) : undefined;
    setYear(nextYear);
  }, []);

  const handleReset = useCallback(() => {
    setCategory(undefined);
    setMonth(undefined);
    setYear(undefined);
    router.push('/cashflow/transactions');
  }, [router]);

  useEffect(() => {
    const params = new URLSearchParams(currentSearchParams);

    params.delete('category');
    params.delete('month');
    params.delete('year');

    if (category) params.set('category', encodeURIComponent(category.toLowerCase()));
    if (month !== undefined) params.set('month', String(month));
    if (year !== undefined) params.set('year', String(year));

    const queryString = params.toString();
    router.replace(queryString ? `/cashflow/transactions?${queryString}` : '/cashflow/transactions');
  }, [category, currentSearchParams, month, router, year]);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  const monthLabel = useCallback((value: number) => new Date(2025, value - 1).toLocaleString('default', { month: 'long' }), []);

  return (
    <div className='mb-6 rounded-lg border border-border bg-background p-4 dark:border-border dark:bg-background'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-3'>
        <div className='flex-1'>
          <label htmlFor='filter-category' className='block text-sm font-medium text-foreground dark:text-foreground'>
            Category
          </label>
          <select
            id='filter-category'
            value={category || ''}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className='mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white'
          >
            <option value=''>All Categories</option>
            {allCategories.map((cat) => (
              <option key={cat.id} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className='flex-1'>
          <label htmlFor='filter-month' className='block text-sm font-medium text-foreground dark:text-foreground'>
            Month
          </label>
          <select
            id='filter-month'
            value={month || ''}
            onChange={(e) => handleMonthChange(e.target.value)}
            className='mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white'
          >
            <option value=''>All Months</option>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>
                {monthLabel(value)}
              </option>
            ))}
          </select>
        </div>

        <div className='flex-1'>
          <label htmlFor='filter-year' className='block text-sm font-medium text-foreground dark:text-foreground'>
            Year
          </label>
          <select
            id='filter-year'
            value={year || ''}
            onChange={(e) => handleYearChange(e.target.value)}
            className='mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white'
          >
            <option value=''>All Years</option>
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <button
          type='button'
          onClick={handleReset}
          className='inline-flex items-center justify-center rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/80 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
        >
          Reset
        </button>
      </div>

      {(category || month !== undefined || year !== undefined) && (
        <div className='mt-3 text-sm text-muted-foreground dark:text-muted-foreground'>
          Showing {category ? `${category}` : 'all categories'}
          {month !== undefined ? ` for ${monthLabel(month)}` : ''}
          {year !== undefined ? ` ${year}` : ''}
        </div>
      )}
    </div>
  );
}
