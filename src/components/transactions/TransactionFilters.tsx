'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import Select from 'react-select';
import type { SingleValue } from 'react-select';
import { Label } from '@/components/ui/Label';
import { getSelectStyles } from '@/lib/select-styles';

export type DatePreset = 'this-month' | 'last-month' | 'this-quarter' | 'this-fy' | 'last-fy' | 'custom';

interface TransactionFiltersProps {
  bankAccounts: Array<{ id: string; name: string; bankName: string }>;
  categoryOptions: Array<{ label: string; value: string }>;
  bankAccountId: string | undefined;
  category: string | undefined;
  dateFrom: string | undefined;
  dateTo: string | undefined;
  search: string;
  amountMin: string;
  amountMax: string;
  onBankChange: (id: string | undefined) => void;
  onCategoryChange: (category: string | undefined) => void;
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

const PRESET_LABELS: Record<DatePreset, string> = {
  'this-month': 'This Month',
  'last-month': 'Last Month',
  'this-quarter': 'This Quarter',
  'this-fy': 'This FY',
  'last-fy': 'Last FY',
  custom: 'Custom',
};

const inputClass =
  'h-8 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:border-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500';

function CalendarIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="none">
      <path
        d="M6 2.75V5M14 2.75V5M3.5 7.25h13M4.5 4.5h11A1.5 1.5 0 0 1 17 6v9.5A1.5 1.5 0 0 1 15.5 17h-11A1.5 1.5 0 0 1 3 15.5V6a1.5 1.5 0 0 1 1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="none">
      <path
        d={direction === 'up' ? 'M5 12.25 10 7.25l5 5' : 'M5 7.75 10 12.75l5-5'}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function TransactionFilters({
  bankAccounts,
  categoryOptions,
  bankAccountId,
  category,
  dateFrom,
  dateTo,
  search,
  amountMin,
  amountMax,
  onBankChange,
  onCategoryChange,
  onDateFromChange,
  onDateToChange,
  onSearchChange,
  onAmountMinChange,
  onAmountMaxChange,
  onReset,
  resetKey,
}: TransactionFiltersProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>('this-fy');
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const minDate = useMemo(() => getTwoYearsAgoDate(), []);
  const bankSelectId = useId();
  const categorySelectId = useId();

  const bankOptions = useMemo(
    () =>
      bankAccounts.map((account) => ({
        label: account.bankName ? `${account.name} (${account.bankName})` : account.name,
        value: account.id,
      })),
    [bankAccounts],
  );

  const selectedBank = bankOptions.find((option) => option.value === bankAccountId) ?? null;
  const selectedCategory =
    categoryOptions.find((option) => option.value === category) ?? null;

  useEffect(() => {
    setDatePreset('this-fy');
    setIsPeriodOpen(false);
  }, [resetKey]);

  const applyPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const range = getPresetDateRange(preset);
    if (!range) return;
    onDateFromChange(range.from);
    onDateToChange(range.to);
  };

  const handleReset = () => {
    setDatePreset('this-fy');
    setIsPeriodOpen(false);
    onReset();
  };

  const dateFromMax = dateTo ?? formatDate(getCurrentDate());
  const dateToMin = dateFrom ?? minDate;
  const activePresetLabel = PRESET_LABELS[datePreset];
  const periodChipActive = isPeriodOpen || datePreset !== 'this-fy';

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700/60 dark:bg-gray-800/40">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-[220px] flex-col gap-0.5">
          <Label htmlFor={bankSelectId} className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Bank Account
          </Label>
          <Select
            instanceId={bankSelectId}
            inputId={bankSelectId}
            name="bankAccountId"
            isClearable
            placeholder="All Accounts"
            value={selectedBank}
            options={bankOptions}
            onChange={(option: SingleValue<(typeof bankOptions)[number]>) => onBankChange(option?.value)}
            styles={getSelectStyles<(typeof bankOptions)[number]>()}
            className="w-full"
            menuPortalTarget={document.body}
          />
        </div>

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
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Description</span>
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

        <div className="flex min-w-[220px] flex-col gap-0.5">
          <Label htmlFor={categorySelectId} className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Category
          </Label>
          <Select
            instanceId={categorySelectId}
            inputId={categorySelectId}
            name="category"
            isClearable
            placeholder="All Categories"
            value={selectedCategory}
            options={categoryOptions}
            onChange={(option: SingleValue<(typeof categoryOptions)[number]>) =>
              onCategoryChange(option?.value)
            }
            styles={getSelectStyles<(typeof categoryOptions)[number]>()}
            className="w-full"
            menuPortalTarget={document.body}
          />
        </div>

        <button
          type="button"
          aria-expanded={isPeriodOpen}
          aria-label={`Period filter: ${activePresetLabel}. Click to ${isPeriodOpen ? 'collapse' : 'expand'}`}
          onClick={() => setIsPeriodOpen((open) => !open)}
          className={`self-end inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
            periodChipActive
              ? 'border-teal-400 bg-teal-50 text-teal-700 dark:border-teal-600 dark:bg-teal-950/40 dark:text-teal-300'
              : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500'
          }`}
        >
          <CalendarIcon />
          <span>{activePresetLabel}</span>
          <ChevronIcon direction={isPeriodOpen ? 'up' : 'down'} />
        </button>

        <button
          type="button"
          onClick={handleReset}
          className="self-end ml-auto text-xs text-gray-400 transition-colors hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:text-gray-500 dark:hover:text-gray-300"
        >
          Reset
        </button>
      </div>

      {isPeriodOpen && (
        <div className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-700/60">
          <div className="flex flex-wrap justify-end gap-1.5">
            {DATE_PRESETS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={datePreset === value}
                onClick={() => {
                  applyPreset(value);
                  setIsPeriodOpen(false);
                }}
                className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                  datePreset === value
                    ? 'border-teal-500 bg-teal-500 text-white dark:border-teal-400 dark:bg-teal-600'
                    : 'border-gray-300 text-gray-500 hover:border-teal-400 hover:text-teal-600 dark:border-gray-600 dark:text-gray-400 dark:hover:border-teal-500 dark:hover:text-teal-300'
                }`}
              >
                {label}
              </button>
            ))}

            <button
              type="button"
              aria-pressed={datePreset === 'custom'}
              onClick={() => setDatePreset('custom')}
              className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                datePreset === 'custom'
                  ? 'border-teal-500 bg-teal-500 text-white dark:border-teal-400 dark:bg-teal-600'
                  : 'border-gray-300 text-gray-500 hover:border-teal-400 hover:text-teal-600 dark:border-gray-600 dark:text-gray-400 dark:hover:border-teal-500 dark:hover:text-teal-300'
              }`}
            >
              Custom
            </button>
          </div>

          {datePreset === 'custom' && (
            <div className="mt-2 flex flex-wrap justify-end gap-x-3 gap-y-2">
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}


