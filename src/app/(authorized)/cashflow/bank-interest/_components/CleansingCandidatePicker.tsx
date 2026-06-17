'use client';

import { CheckCircle2,ChevronDown, ChevronUp } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { useDebounce } from 'use-debounce';

import { SelectWrapper as Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import InfoTooltip from '@/components/ui/InfoTooltip';
import { cn } from '@/lib/utils';
import { type Candidate } from '@/server/services/bank-interest/interest-cleansing.service';
import { trpc } from '@/server/trpc/client';

interface CleansingCandidatePickerProps {
  creditId: string;
  bankAccountId?: string;
  onSelect: (candidate: Candidate) => void;
  alreadySelectedEvidenceIds?: string[];
}

export function CleansingCandidatePicker({
  creditId,
  bankAccountId: initialBankAccountId,
  onSelect,
  alreadySelectedEvidenceIds = [],
}: CleansingCandidatePickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch] = useDebounce(searchTerm, 300);
  const [isPending, startTransition] = useTransition();

  const [selectedBankAccountId, setSelectedBankAccountId] = useState<
    string | undefined
  >(initialBankAccountId);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null,
  );
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: accounts } = trpc.bankAccount.list.useQuery();

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

  const handleAccountChange = (
    option: { value: string; label: string } | null,
  ) => {
    setSelectedBankAccountId(
      option?.value === 'all' ? undefined : option?.value,
    );
    setSelectedCandidateId(null);
    setFocusedIndex(-1);
  };

  const selectedCandidate = useMemo(
    () =>
      candidates?.find(
        (c: Candidate) => c.transactionId === selectedCandidateId,
      ),
    [candidates, selectedCandidateId],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!candidates || candidates.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < candidates.length - 1 ? prev + 1 : prev,
        );
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
    [candidates, focusedIndex],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const getScoreColorClass = (score: number) => {
    if (score >= 80)
      return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800';
    if (score >= 50)
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700';
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className='flex flex-col h-full space-y-4'>
      <div className='flex gap-3'>
        <div className='flex-1 relative'>
          <input
            type='text'
            placeholder='Search by description or amount...'
            value={searchTerm}
            onChange={handleSearchChange}
            className='w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 transition-all'
          />
          {isPending && (
            <div className='absolute right-3 top-1/2 -translate-y-1/2'>
              <div className='animate-spin rounded-full h-4 w-4 border-2 border-amber-500 border-t-transparent' />
            </div>
          )}
        </div>
        <div className='w-64'>
          <Select
            instanceId='cleansing-account-filter'
            options={accountOptions}
            value={accountOptions.find(
              (o) => o.value === (selectedBankAccountId ?? 'all'),
            )}
            onChange={handleAccountChange as any}
          />
        </div>
      </div>

      <div className='flex-1 overflow-y-auto min-h-0 border rounded-xl bg-gray-50/30 dark:bg-gray-900/30 dark:border-gray-800 shadow-inner'>
        {isLoading && (
          <div className='flex flex-col items-center justify-center p-12 space-y-3'>
            <div className='animate-spin rounded-full h-8 w-8 border-4 border-amber-500 border-t-transparent' />
            <p className='text-sm font-medium text-gray-500 dark:text-gray-400'>
              Scanning for candidates...
            </p>
          </div>
        )}

        {!isLoading && candidates && candidates.length === 0 && (
          <div className='flex flex-col items-center justify-center p-12 text-center'>
            <div className='bg-gray-100 dark:bg-gray-800 p-4 rounded-full mb-4'>
              <CheckCircle2 className='h-8 w-8 text-gray-400' />
            </div>
            <p className='text-base font-semibold text-gray-900 dark:text-gray-100'>
              No candidates found
            </p>
            <p className='text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-[280px]'>
              We couldn't find any DEBIT transactions matching your criteria.
              Try adjusting your search or account filters.
            </p>
          </div>
        )}

        {!isLoading && candidates && candidates.length > 0 && (
          <ul
            role='listbox'
            className='divide-y divide-gray-100 dark:divide-gray-800'
          >
            {candidates.map((candidate: Candidate, index: number) => {
              const isSelected =
                selectedCandidateId === candidate.transactionId;
              const isFocused = focusedIndex === index;
              const isExpanded = expandedId === candidate.transactionId;
                const isFullyAllocated = candidate.remainingAmount <= 0;

                return (
                  <li
                    key={candidate.transactionId}
                    role='option'
                    aria-selected={isSelected}
                    onClick={() => !isFullyAllocated && setSelectedCandidateId(candidate.transactionId)}
                    className={cn(
                      'group cursor-pointer transition-all duration-200',
                      isSelected
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500'
                        : 'hover:bg-white dark:hover:bg-gray-800/80 border-l-4 border-transparent',
                      isFocused &&
                        !isSelected &&
                        'bg-gray-100/50 dark:bg-gray-800/50',
                      isFullyAllocated && 'opacity-60 cursor-not-allowed',
                    )}
                  >
                    <div className='p-4'>
                      <div className='flex items-start justify-between gap-4'>
                        <div className='flex flex-col min-w-0 flex-1'>
                          <div className='flex items-center gap-2 mb-1.5'>
                            <Badge
                              variant='outline'
                              className='text-[10px] px-1.5 py-0 uppercase font-bold tracking-wider text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/30'
                            >
                              DEBIT
                            </Badge>
                            {isFullyAllocated && (
                              <Badge
                                variant='secondary'
                                className='text-[10px] px-1.5 py-0 uppercase font-bold tracking-wider bg-gray-200 text-gray-700'
                              >
                                Exhausted
                              </Badge>
                            )}
                            <span className='text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-tight'>
                              {candidate.accountName}
                            </span>
                          </div>

                          <p
                            className={cn(
                              'text-sm font-semibold truncate leading-tight',
                              isSelected
                                ? 'text-amber-900 dark:text-amber-100'
                                : 'text-gray-900 dark:text-gray-100',
                            )}
                          >
                            {candidate.description}
                          </p>

                          <div className='flex items-center gap-2 mt-2 text-[11px] font-medium text-gray-500 dark:text-gray-400'>
                            <span className='bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded'>
                              {candidate.date}
                            </span>
                            <span className='text-gray-300 dark:text-gray-700'>
                              •
                            </span>
                            <span className='text-gray-600 dark:text-gray-300'>
                              {candidate.reasonShort}
                            </span>
                            <button
                              onClick={(e) =>
                                toggleExpand(candidate.transactionId, e)
                              }
                              className='ml-1 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors'
                            >
                              {isExpanded ? (
                                <ChevronUp className='h-3 w-3' />
                              ) : (
                                <ChevronDown className='h-3 w-3' />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className='flex flex-col items-end shrink-0 pt-1'>
                          <span className='text-base font-bold text-gray-900 dark:text-gray-100 tabular-nums'>
                            $
                            {candidate.amount.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <span className='text-[10px] text-gray-500 dark:text-gray-400 mt-0.5'>
                            {candidate.remainingAmount === 0
                              ? 'Fully allocated'
                              : `${candidate.remainingAmount.toLocaleString(undefined, {
                                  style: 'currency',
                                  currency: 'AUD',
                                })} remaining`}
                          </span>
                          <div
                            className={cn(
                              'mt-2 flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold border shadow-sm',
                              getScoreColorClass(candidate.matchPercent),
                            )}
                          >
                            {candidate.matchPercent}% Match
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className='mt-4 pt-4 border-t border-gray-100 dark:border-gray-800/50 animate-in fade-in slide-in-from-top-1 duration-200'>
                          {candidate.existingAllocations.length > 0 && (
                            <div className='mb-4'>
                                <p className='text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2'>Existing Allocations</p>
                                <div className='space-y-1'>
                                    {candidate.existingAllocations.map(alloc => (
                                        <div key={alloc.interestTxId} className='flex justify-between text-xs p-2 rounded bg-amber-50 dark:bg-amber-950/20 text-gray-700 dark:text-gray-300'>
                                            <span>{alloc.description}</span>
                                            <span className='font-mono font-medium'>{alloc.amountApplied.toLocaleString(undefined, {style: 'currency', currency: 'AUD'})}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                          )}
                          <p className='text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed mb-3'>
                            {candidate.reasonLong}
                          </p>
                          <div className='grid grid-cols-4 gap-2'>
                            {Object.entries(
                              candidate.scoreBreakdown.contributionsPercent,
                            ).map(([key, value]) => (
                              <div
                                key={key}
                                className='flex flex-col p-2 rounded bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50'
                              >
                                <span className='text-[9px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-bold mb-1'>
                                  {key}
                                </span>
                                <div className='flex items-end gap-1'>
                                  <span className='text-xs font-bold text-gray-700 dark:text-gray-200'>
                                    {value}%
                                  </span>
                                  <div className='flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-1'>
                                    <div
                                      className='h-full bg-amber-500 transition-all duration-500'
                                      style={{
                                        width: `${(value / candidate.matchPercent) * 100}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                );
            })}
          </ul>
        )}
      </div>

      <div className='flex items-center justify-between py-3 px-1 border-t border-gray-100 dark:border-gray-800'>
        <div className='flex flex-col'>
          <p className='text-xs font-semibold text-gray-700 dark:text-gray-300'>
            {selectedCandidate
              ? '1 candidate selected'
              : 'No candidate selected'}
          </p>
          {selectedCandidate && (
            <p className='text-[10px] text-gray-500 dark:text-gray-400 mt-0.5'>
              Ready to confirm allocation for $
              {selectedCandidate.amount.toFixed(2)}
            </p>
          )}
        </div>
        <div className='flex gap-2'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => setSelectedCandidateId(null)}
            disabled={!selectedCandidateId}
            className='text-xs font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          >
            Clear
          </Button>
          <Button
            size='sm'
            disabled={!selectedCandidate}
            onClick={() => selectedCandidate && onSelect(selectedCandidate)}
            className='bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600 font-bold px-6 shadow-md transition-all active:scale-95'
          >
            <CheckCircle2 className='mr-2 h-4 w-4' />
            Confirm Selection
          </Button>
        </div>
      </div>
    </div>
  );
}
