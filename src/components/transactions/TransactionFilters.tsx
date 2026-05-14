'use client';

import { useEffect, useMemo, useState } from 'react';

export type DatePreset = 'this-month' | 'last-month' | 'this-quarter' | 'this-fy' | 'last-fy' | 'custom';

interface TransactionFiltersProps {
  bankAccounts: Array<{ id: string; name: string }>;
  bankAccountId: string | undefined;
  dateFrom: string | undefined;
  dateTo: string | undefined;
  search: string;
  amountMin: string;
  amountMax: string;
  onBankChange: (id: string | undefined) => void;
  onDateFromChange: (v: string | undefined) => void;
  onDateToChange: (v: string | undefined) => void;
  onSearchChange: (v: string) => void;
  onAmountMinChange: (v: string) => void;
  onAmountMaxChange: (v: string) => void;
  onReset: () => void;
  resetKey?: number;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getCurrentDate() {
  return new Date();
}

function getCurrentQuarterStart(date: Date) {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

function getCurrentFyStart(date: Date) {
  return date.getMonth() >= 6
    ? new Date(date.getFullYear(), 6, 1)
    : new Date(date.getFullYear() - 1, 6, 1);
}

function getLastFyRange(date: Date) {
  if (date.getMonth() >= 6) {
    return {
      from: new Date(date.getFullYear() - 1, 6, 1),
      to: new Date(date.getFullYear(), 5, 30),
    };
  }
  return {
    from: new Date(date.getFullYear() - 2, 6, 1),
    to: new Date(date.getFullYear() - 1, 5, 30),
  };
}

export function getTwoYearsAgoDate(): string {
  const date = getCurrentDate();
  date.setFullYear(date.getFullYear() - 2);
  return formatDate(startOfDay(date));
}

export function getPresetDateRange(preset: DatePreset): { from: string; to: string } | null {
  if (preset === 'custom') return null;

  const today = startOfDay(getCurrentDate());

  if (preset === 'this-month') {
    return { from: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: formatDate(today) };
  }
  if (preset === 'last-month') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return { from: formatDate(start), to: formatDate(endOfMonth(start)) };
  }
  if (preset === 'this-quarter') {
    return { from: formatDate(getCurrentQuarterStart(today)), to: formatDate(today) };
  }
  if (preset === 'this-fy') {
    return { from: formatDate(getCurrentFyStart(today)), to: formatDate(today) };
  }

  const lastFy = getLastFyRange(today);
  return { from: formatDate(lastFy.from), to: formatDate(lastFy.to) };
}

export function getAuFYRange(preset: DatePreset): { from: string; to: string } {
  return getPresetDateRange(preset) ?? getPresetDateRange('this-fy')!;
}

const DATE_PRESETS: Array<{ value: Exclude<DatePreset, 'custom'>; label: string }> = [
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'this-quarter', label: 'This Quarter' },
  { value: 'this-fy', label: 'This FY' },
  { value: 'last-fy', label: 'Last FY' },
];

const inputClass =
  'h-8 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:border-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500';

export default function TransactionFilters({
  bankAccounts,
  bankAccountId,
  dateFrom,
  dateTo,
  search,
  amountMin,
  amountMax,
  onBankChange,
  onDateFromChange,
  onDateToChange,
  onSearchChange,
  onAmountMinChange,
  onAmountMaxChange,
  onReset,
  resetKey,
}: TransactionFiltersProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>('this-fy');
  const minDate = useMemo(() => getTwoYearsAgoDate(), []);

  useEffect(() => {
    setDatePreset('this-fy');
  }, [resetKey]);

  const applyPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const range = getPresetDateRange(preset);
    if (!range) return;
    onDateFromChange(range.from);
    onDateToChange(range.to);
  };

  const dateFromMax = dateTo ?? formatDate(getCurrentDate());
  const dateToMin = dateFrom ?? minDate;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-700/60 dark:bg-gray-800/40">
      {/* Period preset row */}
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 text-xs font-medium text-gray-400 dark:text-gray-500">Period</span>

        {DATE_PRESETS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={datePreset === value}
            onClick={() => applyPreset(value)}
            className={`rounded border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              datePreset === value
                ? 'border-teal-400 bg-teal-50 text-teal-700 dark:border-teal-600 dark:bg-teal-950/40 dark:text-teal-300'
                : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-white hover:text-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}

        <button
          type="button"
          aria-pressed={datePreset === 'custom'}
          onClick={() => setDatePreset('custom')}
          className={`rounded border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
            datePreset === 'custom'
              ? 'border-teal-400 bg-teal-50 text-teal-700 dark:border-teal-600 dark:bg-teal-950/40 dark:text-teal-300'
              : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-white hover:text-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200'
          }`}
        >
          Custom
        </button>
      </div>

      {/* Filter controls row */}
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <label className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Bank Account</span>
          <select
            aria-label="Bank Account"
            name="bankAccountId"
            autoComplete="off"
            value={bankAccountId ?? ''}
            onChange={(e) => onBankChange(e.target.value || undefined)}
            className={`${inputClass} min-w-[140px]`}
          >
            <option value="">All Accounts</option>
            {bankAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>

        {datePreset === 'custom' && (
          <>
            <label className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">From</span>
              <input
                aria-label="Date From"
                name="dateFrom"
                type="date"
                min={minDate}
                max={dateFromMax}
                autoComplete="off"
                value={dateFrom ?? ''}
                onChange={(e) => onDateFromChange(e.target.value || undefined)}
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">To</span>
              <input
                aria-label="Date To"
                name="dateTo"
                type="date"
                min={dateToMin}
                max={formatDate(getCurrentDate())}
                autoComplete="off"
                value={dateTo ?? ''}
                onChange={(e) => onDateToChange(e.target.value || undefined)}
                className={inputClass}
              />
            </label>
          </>
        )}

        <label className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Min $</span>
          <input
            aria-label="Minimum Amount"
            name="amountMin"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            autoComplete="off"
            placeholder="0.00"
            value={amountMin}
            onChange={(e) => onAmountMinChange(e.target.value)}
            className={`${inputClass} w-24`}
          />
        </label>

        <label className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Max $</span>
          <input
            aria-label="Maximum Amount"
            name="amountMax"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            autoComplete="off"
            placeholder="Any"
            value={amountMax}
            onChange={(e) => onAmountMaxChange(e.target.value)}
            className={`${inputClass} w-24`}
          />
        </label>

        <label className="flex min-w-[160px] flex-1 flex-col gap-0.5">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Search</span>
          <input
            aria-label="Search transactions"
            name="search"
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder="Description or category…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className={inputClass}
          />
        </label>

        <button
          type="button"
          onClick={onReset}
          className="mb-0.5 self-end text-xs text-gray-400 transition-colors hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:text-gray-500 dark:hover:text-gray-300"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
