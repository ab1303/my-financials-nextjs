'use client';

import { X, ArrowLeft } from 'lucide-react';
import { CleansingCandidatePicker } from './CleansingCandidatePicker';
import { type Candidate } from '@/server/services/bank-interest/interest-cleansing.service';
import { Button } from '@/components/ui/button';

interface FullPageCleansingPanelProps {
  creditId: string;
  bankAccountId?: string;
  onClose: () => void;
  onSelect: (candidate: Candidate) => void;
  creditAmount: number;
  creditDate: string;
  creditDescription: string;
}

export function FullPageCleansingPanel({
  creditId,
  bankAccountId,
  onClose,
  onSelect,
  creditAmount,
  creditDate,
  creditDescription,
}: FullPageCleansingPanelProps) {
  return (
    <div className='fixed inset-0 z-[60] flex flex-col bg-white dark:bg-gray-950'>
      {/* Header */}
      <header className='flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800'>
        <div className='flex items-center gap-4'>
          <button
            onClick={onClose}
            className='rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
            aria-label='Back'
          >
            <ArrowLeft className='h-5 w-5 text-gray-500' />
          </button>
          <div>
            <h2 className='text-xl font-bold text-gray-900 dark:text-gray-100'>
              Link Evidence for Interest
            </h2>
            <div className='flex items-center gap-2 mt-0.5'>
              <span className='text-sm font-semibold text-amber-600 dark:text-amber-400'>
                ${creditAmount.toFixed(2)}
              </span>
              <span className='text-xs text-gray-500'>•</span>
              <span className='text-xs text-gray-500'>{creditDate}</span>
              <span className='text-xs text-gray-500'>•</span>
              <span className='text-xs text-gray-500 truncate max-w-[300px]' title={creditDescription}>
                {creditDescription}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className='rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-800'
        >
          <X className='h-5 w-5' />
        </button>
      </header>

      {/* Main Content Area */}
      <main className='flex-1 overflow-hidden flex justify-center p-6 bg-gray-50 dark:bg-gray-900/50'>
        <div className='w-full max-w-[1100px] flex flex-col bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden'>
          <div className='flex-1 flex flex-col p-6 min-h-0'>
            <div className='mb-4'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                Select Candidate DEBITs
              </h3>
              <p className='text-sm text-gray-500 dark:text-gray-400 mt-1'>
                Fuzzy matches are ranked by amount, date, description tokens, and account.
              </p>
            </div>

            <div className='flex-1 min-h-0'>
              <CleansingCandidatePicker
                creditId={creditId}
                bankAccountId={bankAccountId}
                onSelect={onSelect}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer / Status bar (optional, already handled in picker) */}
    </div>
  );
}
