'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ChevronDown, ChevronUp, Link2, RotateCcw, Unlink } from 'lucide-react';
import Select from 'react-select';
import type { SingleValue } from 'react-select';
import { trpc } from '@/server/trpc/client';
import TransferLinkDrawer from './TransferLinkDrawer';

interface OrphanResolutionPanelProps {
  onResolved?: () => void;
}

type PickMode = 'expense' | 'income' | null;

interface CategoryOption {
  label: string;
  value: string;
}

const RESOLUTION_LABELS: Record<string, string> = {
  EXPENSE: 'Real expense',
  INCOME: 'Real income',
  EXCLUDED: 'Excluded (single-sided)',
};

export default function OrphanResolutionPanel({ onResolved }: OrphanResolutionPanelProps) {
  const utils = trpc.useUtils();

  // per-orphan pick state: orphanId → 'expense' | 'income' | null
  const [pickMode, setPickMode] = useState<Record<string, PickMode>>({});
  const [selectedCategory, setSelectedCategory] = useState<Record<string, CategoryOption | null>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resetingId, setResetingId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  // Link drawer state
  const [drawerOrphanId, setDrawerOrphanId] = useState<string | null>(null);

  // Linked pairs section state
  const [showLinked, setShowLinked] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const { data: orphans = [], isLoading } = trpc.transfer.getOrphanedTransfers.useQuery({});
  const { data: resolved = [], isLoading: resolvedLoading } = trpc.transfer.getResolvedOrphans.useQuery({ limit: 50 });
  const { data: linkedPairs = [], isLoading: linkedLoading } = trpc.transfer.getLinkedTransferPairs.useQuery();
  const { data: expenseCategories = [] } = trpc.expenseCategory.getAllActive.useQuery();
  const { data: incomeSources = [] } = trpc.incomeSource.getAllActive.useQuery();

  const resolveMutation = trpc.transfer.resolveOrphan.useMutation({
    onSuccess: () => {
      setResolvingId(null);
      void utils.transfer.getOrphanedTransfers.invalidate();
      void utils.transfer.getResolvedOrphans.invalidate();
      onResolved?.();
      toast.success('Transfer resolved');
    },
    onError: (err) => {
      setResolvingId(null);
      toast.error(err.message);
    },
  });

  const resetMutation = trpc.transfer.resetOrphanResolution.useMutation({
    onSuccess: () => {
      setResetingId(null);
      void utils.transfer.getOrphanedTransfers.invalidate();
      void utils.transfer.getResolvedOrphans.invalidate();
      toast.success('Moved back to unresolved');
    },
    onError: (err) => {
      setResetingId(null);
      toast.error(err.message);
    },
  });

  const unlinkMutation = trpc.transfer.unlink.useMutation({
    onSuccess: () => {
      setUnlinkingId(null);
      void utils.transfer.getOrphanedTransfers.invalidate();
      void utils.transfer.getLinkedTransferPairs.invalidate();
      toast.success('Transfer pair unlinked');
    },
    onError: (err) => {
      setUnlinkingId(null);
      toast.error(err.message);
    },
  });

  const expenseCategoryOptions: CategoryOption[] = expenseCategories.map((c) => ({ label: c.name, value: c.name }));
  const incomeSourceOptions: CategoryOption[] = incomeSources.map((s) => ({ label: s.name, value: s.name }));

  function startPick(orphanId: string, mode: 'expense' | 'income') {
    setPickMode((prev) => ({ ...prev, [orphanId]: mode }));
    setSelectedCategory((prev) => ({ ...prev, [orphanId]: null }));
  }

  function cancelPick(orphanId: string) {
    setPickMode((prev) => ({ ...prev, [orphanId]: null }));
    setSelectedCategory((prev) => ({ ...prev, [orphanId]: null }));
  }

  function confirmResolve(orphanId: string) {
    const mode = pickMode[orphanId];
    const category = selectedCategory[orphanId];
    if (!mode || !category) return;
    setResolvingId(orphanId);
    resolveMutation.mutate({
      transactionId: orphanId,
      resolution: mode === 'expense' ? 'EXPENSE' : 'INCOME',
      newCategory: category.value,
    });
  }

  function resolveExclude(orphanId: string) {
    setResolvingId(orphanId);
    resolveMutation.mutate({ transactionId: orphanId, resolution: 'EXCLUDED' });
  }

  const formatDate = (date: string | Date) =>
    new Date(date).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });

  const formatAmount = (amount: number | string) =>
    `$${Math.abs(Number(amount)).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Find the orphan whose drawer is open (for TransferLinkDrawer props)
  const drawerOrphan = drawerOrphanId
    ? (orphans as any[]).find((o) => o.id === drawerOrphanId)
    : null;

  const hasContent =
    (orphans as any[]).length > 0 ||
    (resolved as any[]).length > 0 ||
    (linkedPairs as any[]).length > 0;

  if (isLoading) return null;
  if (!hasContent) return null;

  return (
    <>
      <div className='mb-6 space-y-3'>
        {/* ── Unresolved orphans panel ── */}
        {(orphans as any[]).length > 0 && (
          <div className='rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30'>
            <div className='flex items-start gap-3'>
              <AlertTriangle className='mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500' />
              <div className='flex-1 min-w-0'>
                <h3 className='font-medium text-amber-800 dark:text-amber-200'>
                  {(orphans as any[]).length} orphaned transfer{(orphans as any[]).length !== 1 ? 's' : ''} need resolution
                </h3>
                <p className='mt-0.5 text-sm text-amber-700 dark:text-amber-300'>
                  These transfers have no matching counterpart after 30 days. Classify each one so it&apos;s correctly included in your reports.
                </p>

                <div className='mt-4 space-y-3'>
                  {(orphans as any[]).map((orphan) => {
                    const mode = pickMode[orphan.id] ?? null;
                    const isBusy = resolvingId === orphan.id;
                    const options = mode === 'expense' ? expenseCategoryOptions : incomeSourceOptions;
                    const pickedCategory = selectedCategory[orphan.id] ?? null;

                    return (
                      <div
                        key={orphan.id}
                        className='rounded-lg border border-amber-200 bg-white p-3 dark:border-amber-700 dark:bg-gray-900'
                      >
                        <div className='min-w-0 mb-2'>
                          <p className='text-sm font-medium text-gray-900 truncate dark:text-white'>
                            {orphan.description}
                          </p>
                         <p className='mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400'>
                           <TransactionTypeBadge type={(orphan as any).type} />
                           <span>{formatDate(orphan.date)} · {formatAmount(orphan.amount)} · {(orphan.financialAccount as any)?.name ?? 'Unknown account'}</span>
                          </p>
                        </div>

                        {mode === null ? (
                          /* ── Four-button state ── */
                          <div className='flex flex-wrap gap-2'>
                            <button
                              type='button'
                              disabled={isBusy}
                              onClick={() => startPick(orphan.id, 'expense')}
                              className='rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50'
                            >
                              Real expense
                            </button>
                            <button
                              type='button'
                              disabled={isBusy}
                              onClick={() => startPick(orphan.id, 'income')}
                              className='rounded-md bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50'
                            >
                              Real income
                            </button>
                            <button
                              type='button'
                              disabled={isBusy}
                              onClick={() => resolveExclude(orphan.id)}
                              className='rounded-md bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                            >
                              Exclude (single-sided)
                            </button>
                            <button
                              type='button'
                              disabled={isBusy}
                              onClick={() => setDrawerOrphanId(orphan.id)}
                              className='flex items-center gap-1 rounded-md bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-50 dark:bg-teal-900/30 dark:text-teal-300 dark:hover:bg-teal-900/50'
                            >
                              <Link2 className='h-3 w-3' />
                              Link to counterpart
                            </button>
                          </div>
                        ) : (
                          /* ── Category picker state ── */
                          <div className='mt-2 space-y-2'>
                            <p className='text-xs font-medium text-gray-700 dark:text-gray-300'>
                              {mode === 'expense' ? 'Select expense category:' : 'Select income source:'}
                            </p>
                            <Select<CategoryOption>
                              options={options}
                              value={pickedCategory}
                              onChange={(v: SingleValue<CategoryOption>) =>
                                setSelectedCategory((prev) => ({ ...prev, [orphan.id]: v ?? null }))
                              }
                              placeholder={mode === 'expense' ? 'Expense category…' : 'Income source…'}
                              classNamePrefix='orphan-cat'
                              menuPortalTarget={typeof window !== 'undefined' ? document.body : undefined}
                              styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                              className='text-sm'
                            />
                            <div className='flex gap-2'>
                              <button
                                type='button'
                                disabled={!pickedCategory || isBusy}
                                onClick={() => confirmResolve(orphan.id)}
                                className='rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50'
                              >
                                {isBusy ? 'Saving…' : 'Confirm'}
                              </button>
                              <button
                                type='button'
                                disabled={isBusy}
                                onClick={() => cancelPick(orphan.id)}
                                className='rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300'
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Resolved orphans section ── */}
        {!resolvedLoading && (resolved as any[]).length > 0 && (
          <div className='rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/40'>
            <button
              type='button'
              onClick={() => setShowResolved((v) => !v)}
              className='flex w-full items-center justify-between text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
            >
              <span>{(resolved as any[]).length} resolved transfer{(resolved as any[]).length !== 1 ? 's' : ''}</span>
              {showResolved ? <ChevronUp className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}
            </button>

            {showResolved && (
              <div className='mt-3 space-y-2'>
                {(resolved as any[]).map((tx) => (
                  <div
                    key={tx.id}
                    className='flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900'
                  >
                    <div className='min-w-0'>
                      <p className='text-sm font-medium text-gray-900 truncate dark:text-white'>{tx.description}</p>
                      <p className='mt-0.5 text-xs text-gray-500 dark:text-gray-400'>
                        {formatDate(tx.date)} · {formatAmount(tx.amount)}
                        {tx.orphanResolution && (
                          <span className='ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300'>
                            {RESOLUTION_LABELS[tx.orphanResolution] ?? tx.orphanResolution}
                          </span>
                        )}
                        {tx.category && tx.orphanResolution !== 'EXCLUDED' && (
                          <span className='ml-1 text-gray-400'>· {tx.category}</span>
                        )}
                      </p>
                    </div>
                    <button
                      type='button'
                      disabled={resetingId === tx.id}
                      onClick={() => {
                        setResetingId(tx.id);
                        resetMutation.mutate({ transactionId: tx.id });
                      }}
                      title='Move back to unresolved'
                      className='flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-amber-900/30 dark:hover:text-amber-300'
                    >
                      <RotateCcw className='h-3 w-3' />
                      Re-classify
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Linked transfer pairs section ── */}
        {!linkedLoading && (linkedPairs as any[]).length > 0 && (
          <div className='rounded-xl border border-teal-100 bg-teal-50/50 p-3 dark:border-teal-900/40 dark:bg-teal-950/20'>
            <button
              type='button'
              onClick={() => setShowLinked((v) => !v)}
              className='flex w-full items-center justify-between text-sm font-medium text-teal-700 hover:text-teal-900 dark:text-teal-400 dark:hover:text-teal-200'
            >
              <span className='flex items-center gap-1.5'>
                <Link2 className='h-3.5 w-3.5' />
                {(linkedPairs as any[]).length} linked transfer pair{(linkedPairs as any[]).length !== 1 ? 's' : ''}
              </span>
              {showLinked ? <ChevronUp className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}
            </button>

            {showLinked && (
              <div className='mt-3 space-y-2'>
                {(linkedPairs as any[]).map((pair) => (
                  <div
                    key={pair.id}
                    className='flex flex-wrap items-start justify-between gap-2 rounded-lg border border-teal-100 bg-white px-3 py-2 dark:border-teal-900/30 dark:bg-gray-900'
                  >
                    <div className='min-w-0 flex-1'>
                      <p className='text-sm font-medium text-gray-900 truncate dark:text-white'>
                        {pair.description}
                      </p>
                      <p className='mt-0.5 text-xs text-gray-500 dark:text-gray-400'>
                        {formatDate(pair.date)} · {formatAmount(pair.amount)}
                        {(pair.financialAccount as any)?.name && (
                          <span className='ml-1'>· {(pair.financialAccount as any).name}</span>
                        )}
                      </p>
                      {(pair.transferLinkedTransaction as any) && (
                        <p className='mt-0.5 flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400'>
                          <Link2 className='h-3 w-3 shrink-0' />
                          <span className='truncate'>
                            {(pair.transferLinkedTransaction as any).description}
                            {(pair.transferLinkedTransaction as any).financialAccount?.name && (
                              <span className='text-gray-400'>
                                {' '}· {(pair.transferLinkedTransaction as any).financialAccount.name}
                              </span>
                            )}
                          </span>
                        </p>
                      )}
                    </div>
                    <button
                      type='button'
                      disabled={unlinkingId === pair.id}
                      onClick={() => {
                        setUnlinkingId(pair.id);
                        unlinkMutation.mutate({ transactionId: pair.id });
                      }}
                      title='Unlink this transfer pair'
                      className='flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-red-900/30 dark:hover:text-red-400'
                    >
                      <Unlink className='h-3 w-3' />
                      Unlink
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Transfer Link Drawer (portal) ── */}
      {drawerOrphan && (
        <TransferLinkDrawer
          open={true}
          onClose={() => setDrawerOrphanId(null)}
          sourceTransaction={{
            id: drawerOrphan.id,
            description: drawerOrphan.description,
            amount: Number(drawerOrphan.amount),
            type: (drawerOrphan as any).type ?? 'DEBIT',
            date:
              drawerOrphan.date instanceof Date
                ? drawerOrphan.date.toISOString()
                : String(drawerOrphan.date),
            bankAccountId: (drawerOrphan as any).bankAccountId ?? null,
            bankAccountName: (drawerOrphan.financialAccount as any)?.name ?? null,
          }}
          onLinked={() => {
            setDrawerOrphanId(null);
            setShowLinked(true); // auto-expand linked pairs so the Unlink button is immediately visible
            void utils.transfer.getOrphanedTransfers.invalidate();
            void utils.transfer.getLinkedTransferPairs.invalidate();
            onResolved?.();
            toast.success('Transfer linked — removed from unresolved list');
          }}
        />
      )}
    </>
  );
}

function TransactionTypeBadge({ type }: { type?: string }) {
  if (!type) return null;
  const isDebit = type === 'DEBIT';
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold ${
        isDebit
          ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
          : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
      }`}
    >
      {isDebit ? 'DEBIT' : 'CREDIT'}
    </span>
  );
}
