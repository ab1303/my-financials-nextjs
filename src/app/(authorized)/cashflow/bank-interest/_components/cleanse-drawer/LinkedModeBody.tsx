'use client';

import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CleansingCandidatePicker } from '../CleansingCandidatePicker';
import { BeneficiaryFormFields } from './BeneficiaryFormFields';
import { useCleanseDonation } from './CleanseDonationContext';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
}

export function LinkedModeBody() {
  const {
    transactions,
    selectedTransactionId,
    unlinkedTxQuery,
    selectedTransaction,
    linkedForm,
    selectedEvidence,
    isSaving,
    handleSelectTransaction,
    handleToggleEvidence,
    setIsPickerOpen,
    handleLinkedSave,
    handleClose,
  } = useCleanseDonation();

  const totalAllocated = selectedEvidence.reduce((s, a) => s + a.amount, 0);
  const creditAmount = selectedTransaction?.amount ?? 0;
  const remaining = Math.max(0, creditAmount - totalAllocated);

  return (
    <div className='grid grid-cols-12 h-full overflow-hidden'>
      {/* Left: Unlinked Interest Credits */}
      <aside className='col-span-3 border-r border-gray-200 p-4 dark:border-gray-800 flex flex-col h-full overflow-hidden'>
        <h3 className='mb-3 text-sm font-medium text-gray-700 dark:text-gray-200'>
          Unlinked interest
        </h3>
        <div className='flex-1 overflow-y-auto'>
          {unlinkedTxQuery.isLoading ? (
            <p className='text-sm text-gray-500 dark:text-gray-400'>Loading...</p>
          ) : transactions.length === 0 ? (
            <div className='rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400'>
              No unlinked interest found.
            </div>
          ) : (
            <div className='space-y-2'>
              {transactions.map((tx) => {
                const selected = tx.id === selectedTransactionId;
                return (
                  <button
                    key={tx.id}
                    type='button'
                    onClick={() => handleSelectTransaction(tx.id)}
                    className={`w-full rounded-md border p-3 text-left transition ${
                      selected
                        ? 'border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-950'
                        : 'border-gray-200 hover:border-amber-300 hover:bg-gray-50 dark:border-gray-800 dark:hover:border-amber-700 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className='flex items-center justify-between gap-2'>
                      <span className='text-xs text-gray-500 dark:text-gray-400'>
                        {tx.date}
                      </span>
                      <span className='text-sm font-semibold text-gray-900 dark:text-gray-100'>
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                    <p className='mt-1 line-clamp-1 text-xs text-gray-600 dark:text-gray-400'>
                      {tx.description}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Middle: Evidence Picker */}
      <section className='col-span-6 flex flex-col border-r border-gray-200 dark:border-gray-800 h-full overflow-hidden'>
        <div className='flex flex-col p-4 flex-1 overflow-hidden'>
          <div className='mb-4 flex items-center justify-between shrink-0'>
            <div className='flex flex-col'>
              <h3 className='text-sm font-medium text-gray-700 dark:text-gray-200'>
                Select Evidence (DEBITs)
              </h3>
              {selectedTransaction && (
                <button
                  type='button'
                  onClick={() => setIsPickerOpen(true)}
                  className='text-[10px] text-blue-600 hover:underline text-left font-medium dark:text-blue-400'
                >
                  Full screen / Fuzzy search
                </button>
              )}
            </div>
            {selectedTransaction && (
              <div className='flex gap-2'>
                <Badge variant={remaining === 0 ? 'default' : 'secondary'}>
                  Remaining: {formatCurrency(remaining)}
                </Badge>
              </div>
            )}
          </div>

          <div className='flex-1 overflow-hidden'>
            {!selectedTransaction ? (
              <div className='flex items-center justify-center rounded-md border border-dashed border-gray-300 dark:border-gray-700 h-full'>
                <p className='text-sm text-gray-500 dark:text-gray-400'>
                  Select an interest credit to see suggestions.
                </p>
              </div>
            ) : (
              <CleansingCandidatePicker
                creditId={selectedTransactionId}
                alreadySelectedEvidenceIds={selectedEvidence.map((ev) => ev.id)}
                onSelect={(candidate) =>
                  handleToggleEvidence({
                    id: candidate.transactionId,
                    amount: candidate.amount,
                    description: candidate.description,
                    date: new Date(candidate.date),
                    score: candidate.matchPercent,
                  })
                }
              />
            )}
          </div>
        </div>
      </section>

      {/* Right: Confirmation & Beneficiary */}
      <section className='col-span-3 flex flex-col p-4 h-full overflow-hidden'>
        <h3 className='mb-3 text-sm font-medium text-gray-700 dark:text-gray-200 shrink-0'>
          Allocation Summary
        </h3>

        <div className='mb-4 space-y-3 flex-1 overflow-hidden flex flex-col'>
          <div className='rounded-md bg-gray-50 p-3 dark:bg-gray-950 shrink-0'>
            <div className='flex justify-between text-xs text-gray-500 mb-1'>
              <span>Interest Credit</span>
              <span>{formatCurrency(creditAmount)}</span>
            </div>
            <div className='flex justify-between text-xs font-semibold text-blue-600 dark:text-blue-400'>
              <span>Total Allocated</span>
              <span>{formatCurrency(totalAllocated)}</span>
            </div>
          </div>

          {selectedEvidence.length > 0 && (
            <div className='flex-1 overflow-y-auto rounded-md border border-gray-100 dark:border-gray-800'>
              {selectedEvidence.map((ev) => (
                <div
                  key={ev.id}
                  className='flex items-center justify-between border-b border-gray-50 p-2 last:border-0 dark:border-gray-900'
                >
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-[10px] text-gray-700 dark:text-gray-300'>
                      {ev.description}
                    </p>
                    <p className='text-[10px] text-gray-500'>
                      {formatCurrency(ev.amount)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleEvidence(ev)}
                    className='text-gray-400 hover:text-red-500 transition-colors'
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className='pt-4 border-t border-gray-100 dark:border-gray-800 shrink-0'>
          <BeneficiaryFormFields
            disabled={!selectedTransaction || selectedEvidence.length === 0}
          />

          <div className='mt-6 flex flex-col gap-2'>
            <button
              type='button'
              onClick={handleLinkedSave}
              disabled={
                !selectedTransaction ||
                selectedEvidence.length === 0 ||
                !linkedForm.formState.isValid ||
                isSaving
              }
              className='w-full rounded-md bg-amber-600 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-500 dark:hover:bg-amber-600'
            >
              {isSaving ? 'Processing...' : 'Confirm Allocation'}
            </button>
            <button
              type='button'
              onClick={handleClose}
              className='w-full rounded-md border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
            >
              Cancel
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
