'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { History, GitMerge } from 'lucide-react';
import Link from 'next/link';

import CSVImportWizard from './csv/CSVImportWizard';
import AIImportWizard from './ai/AIImportWizard';
import TransactionLedgerTable from '@/components/transactions/TransactionLedgerTable';
import ImportSessionHistory from '@/components/transactions/ImportSessionHistory';
import { CategoryFilteredLedger } from '@/components/transactions/CategoryFilteredLedger';

interface BankAccount {
  id: string;
  name: string;
  bankName: string;
}

interface ImportCardProps {
  title: string;
  description: string;
  onClick: () => void;
  icon: ReactNode;
}

function ImportCard({ title, description, onClick, icon }: ImportCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick();
      }}
      className="cursor-pointer rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-teal-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400">
          {icon}
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </div>
    </div>
  );
}

interface Props {
  bankAccounts: BankAccount[];
  initialCategory?: string;
  initialCategoryId?: string;
  initialMonth?: number;
  initialYear?: number;
  viewMode?: string;
}

export default function TransactionsClient({
  bankAccounts,
  initialCategory,
  initialCategoryId,
  initialMonth,
  initialYear,
  viewMode,
}: Props) {
  const [csvOpen, setCsvOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleImportComplete = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  // Drill-down mode: category + month present and not explicitly requesting full ledger
  if (initialCategory && initialMonth !== undefined && viewMode !== 'ledger') {
    return (
      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <CategoryFilteredLedger
          category={initialCategory}
          categoryId={initialCategoryId ?? ''}
          month={initialMonth}
          year={initialYear ?? new Date().getFullYear()}
        />
      </main>
    );
  }

  // Normal mode: full transaction management
  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Transactions</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Import and manage your bank transactions
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/cashflow/transfer-rules"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            title="Manage transfer match rules"
          >
            <GitMerge className="h-4 w-4" />
            Transfer Rules
          </Link>
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <History className="h-4 w-4" />
            Import History
          </button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <ImportCard
          title="CSV Bank Statement"
          description="Import transactions from a CommBank CSV statement"
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          }
          onClick={() => setCsvOpen(true)}
        />
        <ImportCard
          title="AI Receipt / Invoice"
          description="Extract expense data from receipt or invoice images"
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          }
          onClick={() => setAiOpen(true)}
        />
      </div>

      <div className="mt-10">
        <TransactionLedgerTable
          bankAccounts={bankAccounts}
          refreshKey={refreshKey}
          initialCategory={initialCategory}
          initialMonth={initialMonth}
          initialYear={initialYear}
        />
      </div>

      <CSVImportWizard
        isOpen={csvOpen}
        onClose={() => setCsvOpen(false)}
        bankAccounts={bankAccounts}
        onImportComplete={handleImportComplete}
      />
      <AIImportWizard
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        bankAccounts={bankAccounts}
      />

      <ImportSessionHistory isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
    </main>
  );
}
