'use client';

import { X, ArrowLeft } from 'lucide-react';
import { CleansingCandidatePicker } from './CleansingCandidatePicker';
import { type Candidate } from '@/server/services/bank-interest/interest-cleansing.service';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
    <div className='fixed inset-0 z-[100] flex flex-col bg-gray-50 dark:bg-gray-950 animate-in fade-in duration-200'>
      {/* Header */}
      <header className='flex items-center justify-between border-b border-gray-200 bg-white px-8 py-5 dark:border-gray-800 dark:bg-gray-900 shadow-sm'>
        <div className='flex items-center gap-6'>
          <button
            onClick={onClose}
            className='group flex items-center gap-2 rounded-full px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all active:scale-95'
            aria-label='Back'
          >
            <ArrowLeft className='h-5 w-5 text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors' />
            <span className='text-sm font-bold text-gray-500 group-hover:text-gray-900 dark:group-hover:text-gray-100'>Back to Ledger</span>
          </button>
          
          <div className='h-8 w-px bg-gray-200 dark:bg-gray-800' />
          
          <div>
            <h2 className='text-xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight'>
              Evidence Retrieval
            </h2>
            <div className='flex items-center gap-2.5 mt-1'>
              <Badge variant='outline' className='bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800 font-bold'>
                Interest ${creditAmount.toFixed(2)}
              </Badge>
              <span className='text-gray-300 dark:text-gray-700 font-light'>|</span>
              <span className='text-xs font-semibold text-gray-500 uppercase tracking-wider'>{creditDate}</span>
              <span className='text-gray-300 dark:text-gray-700 font-light'>|</span>
              <span className='text-xs font-medium text-gray-400 truncate max-w-[400px] italic' title={creditDescription}>
                "{creditDescription}"
              </span>
            </div>
          </div>
        </div>
        
        <button
          onClick={onClose}
          className='rounded-xl p-2.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100 transition-all'
        >
          <X className='h-6 w-6' />
        </button>
      </header>

      {/* Main Content Area */}
      <main className='flex-1 overflow-hidden flex justify-center p-8'>
        <div className='w-full max-w-[1200px] flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-in zoom-in-95 duration-300'>
          <div className='flex-1 flex flex-col min-h-0'>
            <div className='px-8 py-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-950/30'>
              <h3 className='text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2'>
                Select Candidate DEBITs
                <Badge className='ml-2 bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 border-none text-[10px] font-black'>FUZZY MATCHING ACTIVE</Badge>
              </h3>
              <p className='text-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed'>
                Ranked candidates based on amount proximity, date variance, and tokenized description analysis.
              </p>
            </div>

            <div className='flex-1 min-h-0 p-8'>
              <CleansingCandidatePicker
                creditId={creditId}
                bankAccountId={bankAccountId}
                onSelect={onSelect}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
