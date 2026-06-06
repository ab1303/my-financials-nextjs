'use client';

import { useState, useMemo, useTransition, useEffect, useCallback } from 'react';
import { useDebounce } from 'use-debounce';
import { ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { trpc } from '@/server/trpc/client';
import { type Candidate } from '@/server/services/bank-interest/interest-cleansing.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppSelect from '@/components/ui/AppSelect';
import InfoTooltip from '@/components/ui/InfoTooltip';
import { cn } from '@/lib/utils';

interface CleansingCandidatePickerProps {
  creditId: string;
  bankAccountId?: string;
  onSelect: (candidate: Candidate) => void;
}

export function CleansingCandidatePicker({
  creditId,
  bankAccountId: initialBankAccountId,
  onSelect,
}: CleansingCandidatePickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch] = useDebounce(searchTerm, 300);
  const [isPending, startTransition] = useTransition();

  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | undefined>(
    initialBankAccountId
  );
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const { data: accounts } = trpc.bankAccount.getBankAccounts.useQuery();

  const { data: candidates, isLoading } =
    trpc.bankInterest.getCleansingDebitCandidates.useQuery(
      {
        creditId,
        bankAccountId: selectedBankAccountId,
        search: debouncedSearch,
      },
      {
        enabled: !!creditId,
        placeholderData: (previousData: Candidate[] | undefined) =>
          previousData, // Keeps previous data while fetching new
      },
    );

  const accountOptions = useMemo(() => {
    const options = (accounts ?? []).map((acc) => ({
      value: acc.id,
      label: acc.name,
    }));
    return [{ value: 'all', label: 'All accounts' }, ...options];
  }, [accounts]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    startTransition(() => {
      setSearchTerm(value);
      setSelectedCandidateId(null);
      setFocusedIndex(-1);
    });
  };

  const handleAccountChange = (option: { value: string; label: string } | null) => {
    setSelectedBankAccountId(option?.value === 'all' ? undefined : option?.value);
    setSelectedCandidateId(null);
    setFocusedIndex(-1);
  };

  const selectedCandidate = useMemo(
    () => candidates?.find((c) => c.transactionId === selectedCandidateId),
    [candidates, selectedCandidateId]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!candidates || candidates.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev < candidates.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter') {
        if (focusedIndex >= 0 && focusedIndex < candidates.length) {
          e.preventDefault();
          setSelectedCandidateId(candidates[focusedIndex]!.transactionId);
        }
      } else if (e.key === 'Escape') {
        setSelectedCandidateId(null);
        setFocusedIndex(-1);
      }
    },
    [candidates, focusedIndex]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const getScoreColorClass = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200';
    if (score >= 50) return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200';
  };

  return (
    <div className='flex flex-col h-full space-y-4'>
      <div className='flex gap-2'>
        <div className='flex-1'>
          <input
            type='text'
            placeholder='Search by description or amount...'
            value={searchTerm}
            onChange={handleSearchChange}
            className='w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100'
          />
        </div>
        <div className='w-48'>
          <AppSelect
            options={accountOptions}
            value={accountOptions.find((o) => o.value === (selectedBankAccountId ?? 'all'))}
            onChange={handleAccountChange as any}
            compact
          />
        </div>
      </div>

      <div className='flex-1 overflow-y-auto min-h-0 border rounded-md dark:border-gray-800'>
        {isLoading && (
          <div className='flex items-center justify-center p-8'>
            <p className='text-sm text-gray-500 dark:text-gray-400'>Loading candidates...</p>
          </div>
        )}

        {!isLoading && candidates && candidates.length === 0 && (
          <div className='flex flex-col items-center justify-center p-8 text-center'>
            <p className='text-sm text-gray-500 dark:text-gray-400'>No candidates found.</p>
            <p className='text-xs text-gray-400 dark:text-gray-500 mt-1'>Try adjusting your search or filters.</p>
          </div>
        )}

        {!isLoading && candidates && candidates.length > 0 && (
          <ul role='listbox' className='divide-y divide-gray-100 dark:divide-gray-800'>
            {candidates.map((candidate: Candidate, index: number) => {
              const isSelected = selectedCandidateId === candidate.transactionId;
              const isFocused = focusedIndex === index;
              
              return (
                <li
                  key={candidate.transactionId}
                  role='option'
                  aria-selected={isSelected}
                  onClick={() => setSelectedCandidateId(candidate.transactionId)}
                  className={cn(
                    'group cursor-pointer p-4 transition-colors',
                    isSelected ? 'bg-amber-50 dark:bg-amber-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                    isFocused && !isSelected && 'ring-2 ring-inset ring-amber-500/50'
                  )}
                >
                  <div className='flex items-start justify-between gap-4'>
                    <div className='flex flex-col min-w-0 flex-1'>
                      <div className='flex items-center gap-2 mb-1'>
                        <Badge variant='outline' className='text-[10px] uppercase font-bold text-green-600 border-green-200 dark:text-green-400 dark:border-green-900'>
                          DEBIT
                        </Badge>
                        <span className='text-[10px] font-medium text-gray-500 truncate'>
                          {candidate.accountName}
                        </span>
                      </div>
                      
                      <p className={cn(
                        'text-sm font-medium truncate',
                        isSelected ? 'text-amber-900 dark:text-amber-100' : 'text-gray-900 dark:text-gray-100'
                      )}>
                        {candidate.description}
                      </p>
                      
                      <div className='flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400'>
                        <span>{candidate.date}</span>
                        <span>•</span>
                        <span>{candidate.reasonShort}</span>
                        <InfoTooltip text={candidate.reasonLong} />
                      </div>
                    </div>

                    <div className='flex flex-col items-end shrink-0'>
                      <span className='text-sm font-bold text-gray-900 dark:text-gray-100'>
                        ${candidate.amount.toFixed(2)}
                      </span>
                      <div className={cn(
                        'mt-1 flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold border',
                        getScoreColorClass(candidate.matchPercent)
                      )}>
                        {candidate.matchPercent}%
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className='flex items-center justify-between pt-2'>
        <p className='text-xs text-gray-500 dark:text-gray-400 italic'>
          {selectedCandidate ? '1 candidate selected' : 'Select a candidate to confirm'}
        </p>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setSelectedCandidateId(null)}
            disabled={!selectedCandidateId}
          >
            Clear
          </Button>
          <Button
            size='sm'
            disabled={!selectedCandidate}
            onClick={() => selectedCandidate && onSelect(selectedCandidate)}
            className='bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600'
          >
            <CheckCircle2 className='mr-2 h-4 w-4' />
            Confirm Selection
          </Button>
        </div>
      </div>
    </div>
  );
}

