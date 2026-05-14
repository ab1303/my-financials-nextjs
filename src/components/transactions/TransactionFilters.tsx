'use client';

interface TransactionFiltersProps {
  bankAccounts: Array<{ id: string; name: string }>;
  bankAccountId: string | undefined;
  dateFrom: string | undefined;
  dateTo: string | undefined;
  search: string;
  onBankChange: (id: string | undefined) => void;
  onDateFromChange: (v: string | undefined) => void;
  onDateToChange: (v: string | undefined) => void;
  onSearchChange: (v: string) => void;
  onReset: () => void;
}

export default function TransactionFilters({
  bankAccounts,
  bankAccountId,
  dateFrom,
  dateTo,
  search,
  onBankChange,
  onDateFromChange,
  onDateToChange,
  onSearchChange,
  onReset,
}: TransactionFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 md:grid-cols-2 xl:grid-cols-5">
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
        Bank Account
        <select
          aria-label="Bank Account"
          className="rounded border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          value={bankAccountId ?? ''}
          onChange={(e) => onBankChange(e.target.value || undefined)}
        >
          <option value="">All Accounts</option>
          {bankAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
        Date From
        <input
          aria-label="Date From"
          type="date"
          className="rounded border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          value={dateFrom ?? ''}
          onChange={(e) => onDateFromChange(e.target.value || undefined)}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
        Date To
        <input
          aria-label="Date To"
          type="date"
          className="rounded border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          value={dateTo ?? ''}
          onChange={(e) => onDateToChange(e.target.value || undefined)}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 md:col-span-2 xl:col-span-1">
        Search
        <input
          aria-label="Search"
          type="text"
          placeholder="Search description or category"
          className="rounded border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </label>

      <div className="flex items-end">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex w-full items-center justify-center rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
