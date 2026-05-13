'use client';

import { useState, type ReactNode, type KeyboardEvent } from 'react';

import AIImportWizard from './ai/AIImportWizard';
import CSVImportWizard from './csv/CSVImportWizard';

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
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') onClick();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className="cursor-pointer rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 p-6 shadow-sm transition-all hover:border-teal-300 hover:shadow-md"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400">
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
}

export default function TransactionsClient({ bankAccounts }: Props) {
  const [csvOpen, setCsvOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Transactions</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Import and manage your bank transactions
      </p>

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

      <CSVImportWizard
        isOpen={csvOpen}
        onClose={() => setCsvOpen(false)}
        bankAccounts={bankAccounts}
      />
      <AIImportWizard
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        bankAccounts={bankAccounts}
      />
    </main>
  );
}