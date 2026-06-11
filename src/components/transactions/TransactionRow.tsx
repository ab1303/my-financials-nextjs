'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { SingleValue } from 'react-select';
import {
  AsyncSelectWrapper as AsyncSelect,
  SelectWrapper as Select,
} from '@/components/ui/Select';

import { getCompactSelectStyles } from '@/lib/select-styles';
import {
  REIMBURSEMENT_CATEGORY,
  TRANSFER_CATEGORY,
} from '@/server/services/transactions/constants';
import { trpc } from '@/server/trpc/client';
import type { TransactionRow as LedgerTransactionRow } from '@/server/trpc/router/transaction-ledger';

import CategoryRuleDrawer from './CategoryRuleDrawer';
import CategoryRulePrompt from './CategoryRulePrompt';
import { useCategoryEdit } from './hooks/useCategoryEdit';
import ReimbursementSubRow from './ReimbursementSubRow';
import RestoreTransactionButton from './RestoreTransactionButton';
import TransactionSourceIndicator from './TransactionSourceIndicator';
import { UnlinkTransferButton } from './UnlinkTransferButton';
import VoidTransactionButton from './VoidTransactionButton';

interface TransactionRowProps {
  transaction: LedgerTransactionRow;
  expenseCategories: Array<{ id: string; name: string }>;
  incomeSourceLabels: Array<{ id: string; name: string }>;
  onCategoryChange: (
    id: string,
    newCategory: string,
    offsetCategory?: string,
    offsetTransactionId?: string | null,
    applyToMatching?: boolean,
  ) => void;
  isSaving?: boolean;
  colCount?: number;
  onVoided?: () => void;
  onRestored?: () => void;
  onLinkTransfer?: () => void;
  onUnlinked?: () => void;
  onClassifyAsDonation?: (transactionId: string) => void;
  onClassifyAsZakat?: (transactionId: string) => void;
  isInReviewBatch?: boolean;
  /** Whether this row's rule prompt is currently active (parent-owned) */
  showRulePrompt?: boolean;
  /** Count to display in the rule prompt */
  rulePromptCount?: number;
  /** Dismiss the active rule prompt */
  onRulePromptDismiss?: () => void;
  /** Notify parent that this row has found similar transactions */
  onSuggestRule?: (count: number, category: string) => void;
  /** Notify parent to clear the rule prompt for this row */
  onClearRulePrompt?: () => void;
  /** Pause the delayed refetch while the rule drawer is open */
  onPausePendingRefresh?: () => void;
  /** Flush the delayed refetch after the rule prompt is resolved */
  onResolvePendingRefresh?: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(value);
}

type CategoryOption = {
  label: string;
  value: string;
};

type LinkOption = {
  label: string;
  value: string;
  meta: string;
  category: string;
};

export default function TransactionRow({
  transaction,
  expenseCategories,
  incomeSourceLabels,
  onCategoryChange,
  isSaving = false,
  colCount = 10,
  onVoided,
  onRestored,
  onLinkTransfer,
  onUnlinked,
  onClassifyAsDonation,
  onClassifyAsZakat,
  isInReviewBatch = false,
  showRulePrompt = false,
  rulePromptCount = 0,
  onRulePromptDismiss,
  onSuggestRule,
  onClearRulePrompt,
  onPausePendingRefresh,
  onResolvePendingRefresh,
}: TransactionRowProps) {
  const statusClasses: Record<string, string> = {
    CONFIRMED:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    PENDING:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    EXCLUDED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    VOIDED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };

  const [localCategory, setLocalCategory] = useState(transaction.category);
  const [localOffsetCategory, setLocalOffsetCategory] = useState(
    transaction.offsetCategory ?? '',
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [localOffsetTxId, setLocalOffsetTxId] = useState<string | null>(
    transaction.offsetTransactionId ?? null,
  );
  const [selectedLinkOption, setSelectedLinkOption] =
    useState<LinkOption | null>(null);
  const categorySelectId = useId();
  const offsetCategorySelectId = useId();
  const linkSelectId = useId();
  const utils = trpc.useUtils();

  // Use the extracted category edit hook
  const {
    localCategory: hookLocalCategory,
    showRuleDrawer,
    setShowRuleDrawer,
    ruleCategory,
    handleChange: hookHandleChange,
  } = useCategoryEdit({
    transaction,
    isInReviewBatch,
    onCategoryChange,
    onSuggestRule,
    onClearRulePrompt,
  });

  // Keep localCategory synced with hook value
  useEffect(() => {
    setLocalCategory(hookLocalCategory);
  }, [hookLocalCategory]);

  useEffect(() => {
    setLocalOffsetCategory(transaction.offsetCategory ?? '');
  }, [transaction.offsetCategory]);

  useEffect(() => {
    setLocalOffsetTxId(transaction.offsetTransactionId ?? null);
  }, [transaction.offsetTransactionId]);

  useEffect(() => {
    if (!transaction.offsetTransactionId) {
      setSelectedLinkOption(null);
      return;
    }

    setSelectedLinkOption((current) =>
      current?.value === transaction.offsetTransactionId
        ? current
        : {
            label: 'Linked expense',
            value: transaction.offsetTransactionId ?? '',
            meta: '',
            category: transaction.offsetCategory ?? '',
          },
    );
  }, [transaction.offsetTransactionId]);

  const amountClass =
    transaction.type === 'DEBIT' ? 'text-red-600' : 'text-green-600';
  const options =
    transaction.type === 'DEBIT' ? expenseCategories : incomeSourceLabels;

  const showReimbursementOption =
    transaction.category === REIMBURSEMENT_CATEGORY ||
    localCategory === REIMBURSEMENT_CATEGORY ||
    (transaction.type === 'CREDIT' &&
      (transaction.status === 'CONFIRMED' ||
        transaction.status === 'EXCLUDED')) ||
    (transaction.type === 'DEBIT' && transaction.status === 'CONFIRMED');

  // Transfer is a special system category valid for any transaction;
  // show it when the row is currently Transfer, or when it's EXCLUDED (so the user can restore it).
  const showTransferOption =
    transaction.category === TRANSFER_CATEGORY ||
    localCategory === TRANSFER_CATEGORY ||
    transaction.status === 'EXCLUDED';

  const categoryOptions = useMemo<CategoryOption[]>(
    () => [
      ...options.map((option) => ({
        label: option.name,
        value: option.name,
      })),
      ...(showReimbursementOption
        ? [{ label: REIMBURSEMENT_CATEGORY, value: REIMBURSEMENT_CATEGORY }]
        : []),
      ...(showTransferOption
        ? [{ label: TRANSFER_CATEGORY, value: TRANSFER_CATEGORY }]
        : []),
    ],
    [options, showReimbursementOption, showTransferOption],
  );

  const offsetCategoryOptions = useMemo<CategoryOption[]>(
    () =>
      expenseCategories.map((category) => ({
        label: category.name,
        value: category.name,
      })),
    [expenseCategories],
  );

  const selectedCategory =
    categoryOptions.find((option) => option.value === localCategory) ?? null;

  const selectedOffsetCategory =
    offsetCategoryOptions.find(
      (option) => option.value === localOffsetCategory,
    ) ?? null;
  const compactSelectStyles = getCompactSelectStyles<CategoryOption>();
  const linkSelectStyles = getCompactSelectStyles<LinkOption>();

  const totalReimbursed = transaction.reimbursements.reduce(
    (sum, reimbursement) => sum + reimbursement.amount,
    0,
  );
  const netAmount = transaction.amount - totalReimbursed;
  const hasReimbursements = transaction.reimbursements.length > 0;

  const loadLinkOptions = useCallback(
    async (inputValue: string): Promise<LinkOption[]> => {
      const trimmed = inputValue.trim();

      // For default options (no search term), limit to last 120 days to keep the list manageable.
      // When the user types a search term, search all time so older expenses are discoverable.
      let dateFrom: string | undefined;
      let dateTo: string | undefined;
      if (!trimmed) {
        const to = new Date();
        const from = new Date(to);
        from.setDate(from.getDate() - 120);
        dateFrom = from.toISOString().slice(0, 10);
        dateTo = to.toISOString().slice(0, 10);
      }

      try {
        const matches =
          await utils.transactionLedger.searchDebitTransactions.fetch({
            search: trimmed || undefined,
            limit: 50,
            ...(dateFrom ? { dateFrom } : {}),
            ...(dateTo ? { dateTo } : {}),
          });

        return matches.map((match) => ({
          value: match.id,
          label: `${match.date} - ${match.description} (${formatCurrency(match.amount)})`,
          category: match.category,
          meta: match.category,
        }));
      } catch (error) {
        console.error(
          '[ReimbursementLinkage] Failed to load expense options:',
          error,
        );
        return [];
      }
    },
    [utils],
  );

  function handleChange(newCategory: string) {
    // Keep the local offset category reset logic in the component
    if (newCategory !== REIMBURSEMENT_CATEGORY) {
      setLocalOffsetCategory('');
    }
    // Delegate to hook for all category change logic
    hookHandleChange(newCategory);
  }

  function handleOffsetChange(newOffsetCategory: string) {
    setLocalOffsetCategory(newOffsetCategory);
    onCategoryChange(
      transaction.id,
      REIMBURSEMENT_CATEGORY,
      newOffsetCategory,
      localOffsetTxId,
      false, // never auto-apply Reimbursement changes
    );
  }

  function handleLinkTransaction(linkedOption: LinkOption | null) {
    const linkedId = linkedOption?.value ?? null;
    // Auto-derive offsetCategory from the linked DEBIT's category if not already chosen.
    const derivedOffsetCategory = linkedOption?.category ?? '';
    const effectiveOffsetCategory =
      localOffsetCategory || derivedOffsetCategory;
    setSelectedLinkOption(linkedOption);
    setLocalOffsetTxId(linkedId);
    if (!localOffsetCategory && derivedOffsetCategory) {
      setLocalOffsetCategory(derivedOffsetCategory);
    }
    setPickerOpen(false);
    onCategoryChange(
      transaction.id,
      REIMBURSEMENT_CATEGORY,
      effectiveOffsetCategory || undefined,
      linkedId,
      false, // never auto-apply Reimbursement changes
    );
  }

  function handleResetLinkPicker() {
    setPickerOpen(false);
  }

  const formatLinkOptionLabel = (option: LinkOption) => (
    <div className='flex w-full items-center justify-between gap-3'>
      <span className='truncate'>{option.label}</span>
      <span className='shrink-0 tabular-nums text-xs text-gray-500 dark:text-gray-400'>
        {option.meta}
      </span>
    </div>
  );

  function extractPattern(description: string): string {
    const STOP_WORDS = new Set([
      'to',
      'from',
      'the',
      'a',
      'an',
      'and',
      'or',
      'of',
      'in',
      'at',
      'on',
      'for',
      'by',
    ]);
    return description
      .toLowerCase()
      .split(/\W+/)
      .filter(Boolean)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
      .slice(0, 3)
      .join(' ');
  }

  return (
    <>
      <tr className='border-b border-gray-200 dark:border-gray-700'>
        <td className='overflow-hidden px-1 py-3 text-center'>
          {hasReimbursements && (
            <button
              type='button'
              aria-label={
                isExpanded ? 'Collapse reimbursements' : 'Expand reimbursements'
              }
              onClick={() => setIsExpanded((v) => !v)}
              className='text-gray-400 transition-colors hover:text-teal-500'
            >
              {isExpanded ? '▾' : '▸'}
            </button>
          )}
        </td>
        <td className='overflow-hidden px-4 py-3 text-sm text-gray-700 dark:text-gray-300'>
          {transaction.date.slice(0, 10)}
        </td>
        <td className='overflow-hidden px-4 py-3 text-sm text-gray-900 dark:text-white'>
          <span className='block truncate' title={transaction.description}>
            {transaction.description}
          </span>
        </td>
        <td
          className={`overflow-hidden px-4 py-3 text-sm font-medium tabular-nums ${amountClass}`}
        >
          <div className='flex flex-col'>
            <span>{formatCurrency(transaction.amount)}</span>
            {hasReimbursements && (
              <span className='text-xs text-teal-600 dark:text-teal-400'>
                net {formatCurrency(netAmount)}
              </span>
            )}
          </div>
        </td>
        <td className='overflow-hidden px-4 py-3 text-sm text-gray-700 dark:text-gray-300'>
          {transaction.type}
        </td>
        <td className='overflow-hidden px-4 py-3'>
          <div className='flex flex-col gap-1'>
            <Select
              instanceId={categorySelectId}
              inputId={categorySelectId}
              aria-label={`Category for ${transaction.description}`}
              isDisabled={isSaving}
              isClearable={false}
              value={selectedCategory}
              options={categoryOptions}
              onChange={(option) =>
                handleChange((option as CategoryOption)?.value ?? '')
              }
              styles={{
                ...compactSelectStyles,
              }}
              className='w-full'
              usePortal
            />

            {localCategory === REIMBURSEMENT_CATEGORY && (
              <>
                {transaction.type === 'CREDIT' ? (
                  <>
                    {localOffsetTxId ? (
                      /* LINKED STATE: single compound chip — link + derived category as one unit */
                      <div className='mt-1 flex items-center gap-1.5 overflow-hidden rounded-md border border-teal-300 bg-teal-50 px-2 py-1.5 text-xs dark:border-teal-700 dark:bg-teal-950/30'>
                        <span
                          className='shrink-0 text-teal-500'
                          aria-hidden='true'
                        >
                          🔗
                        </span>
                        <span className='min-w-0 flex-1 truncate text-teal-700 dark:text-teal-300'>
                          {selectedLinkOption?.label ?? 'Linked expense'}
                        </span>
                        {localOffsetCategory && (
                          <span className='shrink-0 rounded bg-teal-100 px-1.5 py-0.5 font-medium text-teal-600 dark:bg-teal-900/60 dark:text-teal-400'>
                            {localOffsetCategory}
                          </span>
                        )}
                        <button
                          type='button'
                          aria-label='Unlink expense'
                          onClick={() => handleLinkTransaction(null)}
                          className='ml-0.5 shrink-0 rounded-full p-0.5 text-gray-400 transition-colors hover:bg-red-100 hover:text-red-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400 dark:hover:bg-red-900/30'
                        >
                          <svg
                            className='h-3 w-3'
                            viewBox='0 0 12 12'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth={1.8}
                            strokeLinecap='round'
                            aria-hidden='true'
                          >
                            <path d='M1 1l10 10M11 1L1 11' />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      /* UNLINKED STATE: link action + offset category side by side */
                      <div className='mt-1 flex flex-col gap-1'>
                        {!pickerOpen ? (
                          <button
                            type='button'
                            onClick={() => setPickerOpen(true)}
                            className='self-start text-xs text-teal-600 hover:underline dark:text-teal-400'
                          >
                            ＋ Link to original expense
                          </button>
                        ) : (
                          <div className='flex flex-col gap-1'>
                            <AsyncSelect<LinkOption, false>
                              instanceId={linkSelectId}
                              inputId={linkSelectId}
                              aria-label={`Link original expense for ${transaction.description}`}
                              autoFocus
                              cacheOptions
                              defaultOptions
                              isClearable
                              isDisabled={isSaving}
                              menuIsOpen
                              menuPortalTarget={document.body}
                              menuPosition='fixed'
                              placeholder='Search expenses…'
                              loadOptions={loadLinkOptions}
                              value={selectedLinkOption}
                              getOptionValue={(option) => option.value}
                              formatOptionLabel={formatLinkOptionLabel}
                              onChange={(option: SingleValue<LinkOption>) =>
                                handleLinkTransaction(option ?? null)
                              }
                              styles={{
                                ...linkSelectStyles,
                                menuPortal: (base) => ({
                                  ...base,
                                  zIndex: 9999,
                                  width: '400px', // Explicitly wider
                                }),
                                control: (base) => ({
                                  ...base,
                                  width: '400px', // Also wider
                                }),
                              }}
                              className='w-full'
                              noOptionsMessage={({ inputValue }) =>
                                inputValue.trim()
                                  ? 'No matching expenses found'
                                  : 'No recent expenses — type to search all time'
                              }
                            />
                            <button
                              type='button'
                              onClick={handleResetLinkPicker}
                              className='mt-1 text-xs text-gray-400 hover:text-gray-600'
                            >
                              Reset
                            </button>
                          </div>
                        )}
                        {/* offset category — only visible when not linked; allows category-only reimbursement */}
                        <Select
                          instanceId={offsetCategorySelectId}
                          inputId={offsetCategorySelectId}
                          aria-label={`Offsets expense category for ${transaction.description}`}
                          isDisabled={isSaving}
                          isClearable={false}
                          placeholder='Offsets category…'
                          value={selectedOffsetCategory}
                          options={offsetCategoryOptions}
                          onChange={(option) =>
                            handleOffsetChange(
                              (option as CategoryOption)?.value ?? '',
                            )
                          }
                          styles={{
                            ...compactSelectStyles,
                          }}
                          className='w-full'
                          usePortal
                        />
                      </div>
                    )}
                  </>
                ) : (
                  /* DEBIT Reimbursement: simple "awaiting payback" badge, no offsetCategory needed */
                  <span className='mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'>
                    ⏳ Awaiting payback
                  </span>
                )}
              </>
            )}
          </div>
        </td>
        <td className='overflow-hidden px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300'>
          <TransactionSourceIndicator source={transaction.source} />
        </td>
        <td className='overflow-hidden px-4 py-3'>
          <div className='flex flex-col gap-1'>
            <span
              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClasses[transaction.status] ?? statusClasses.EXCLUDED}`}
            >
              {transaction.status}
            </span>
            {transaction.category === REIMBURSEMENT_CATEGORY && (
              <span className='inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-900/30 dark:text-teal-300'>
                ↩ {transaction.offsetCategory ?? 'Reimbursement'}
              </span>
            )}
            {transaction.category.toLowerCase() === 'gifts & donations' &&
              transaction.type === 'DEBIT' && (
                <>
                  {transaction.isDonationLinked && (
                    <span
                      className={clsx(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
                      )}
                    >
                      🔗 Donation linked
                    </span>
                  )}
                  {transaction.isZakatLinked && (
                    <span
                      className={clsx(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                      )}
                    >
                      🔗 Zakat linked
                    </span>
                  )}
                  {!transaction.isDonationLinked &&
                    !transaction.isZakatLinked && (
                      <span
                        className={clsx(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
                        )}
                      >
                        ⚠️ Needs classification
                      </span>
                    )}
                </>
              )}
            {transaction.transferCounterpart && (
              <div className='mt-1 flex items-center gap-1.5 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs dark:border-blue-800 dark:bg-blue-950/30'>
                <span className='shrink-0 text-blue-500'>⇄</span>
                <div className='min-w-0 flex-1'>
                  <span className='block truncate font-medium text-blue-800 dark:text-blue-300'>
                    {transaction.transferCounterpart.description}
                  </span>
                  <span className='block text-blue-600 dark:text-blue-400'>
                    {transaction.transferCounterpart.date.slice(0, 10)}
                    {' · '}
                    {transaction.transferCounterpart.bankAccountName ??
                      'Unknown account'}
                    {' · '}${transaction.transferCounterpart.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </td>
        <td className='overflow-hidden px-4 py-3 text-sm text-gray-700 dark:text-gray-300'>
          {transaction.bankAccountName
            ? `${transaction.bankAccountName}${transaction.bankName ? ` (${transaction.bankName})` : ''}`
            : (transaction.bankName ?? '-')}
        </td>
        <td className='overflow-hidden px-4 py-3'>
          <div className='flex flex-wrap items-center gap-2'>
            {transaction.status !== 'VOIDED' && onVoided && (
              <VoidTransactionButton
                transactionId={transaction.id}
                onVoided={onVoided}
                status={transaction.status}
              />
            )}
            {transaction.status === 'VOIDED' && onRestored && (
              <RestoreTransactionButton
                transactionId={transaction.id}
                onRestored={onRestored}
              />
            )}
            {(transaction.transferLinkedTransactionId != null ||
              transaction.transferCounterpartId != null) && (
              <UnlinkTransferButton
                transactionId={transaction.id}
                onUnlinked={onUnlinked ?? (() => {})}
              />
            )}
            {onLinkTransfer &&
              transaction.transferLinkedTransactionId == null &&
              transaction.transferCounterpartId == null && (
                <button
                  type='button'
                  onClick={onLinkTransfer}
                  className='rounded px-2 py-1 text-xs font-medium text-teal-600 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-900/20'
                  title='Link as Transfer'
                >
                  Link
                </button>
              )}
            {transaction.category.toLowerCase() === 'gifts & donations' &&
              transaction.type === 'DEBIT' &&
              !transaction.isDonationLinked &&
              !transaction.isZakatLinked && (
                <>
                  {onClassifyAsDonation && (
                    <button
                      type='button'
                      onClick={() => onClassifyAsDonation(transaction.id)}
                      className='rounded px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20'
                      title='Classify as Donation'
                    >
                      🎁 Donation
                    </button>
                  )}
                  {onClassifyAsZakat && (
                    <button
                      type='button'
                      onClick={() => onClassifyAsZakat(transaction.id)}
                      className='rounded px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
                      title='Classify as Zakat'
                    >
                      🕌 Zakat
                    </button>
                  )}
                </>
              )}
          </div>
        </td>
      </tr>

      {showRulePrompt && (
        <CategoryRulePrompt
          count={rulePromptCount}
          colCount={colCount}
          onCreateRule={() => {
            onPausePendingRefresh?.();
            onRulePromptDismiss?.();
            setShowRuleDrawer(true);
          }}
          onDismiss={() => {
            onRulePromptDismiss?.();
            onResolvePendingRefresh?.();
          }}
        />
      )}

      {showRuleDrawer && (
        <CategoryRuleDrawer
          open={showRuleDrawer}
          initialPattern={extractPattern(transaction.description)}
          initialCategory={ruleCategory}
          transactionDescription={transaction.description}
          onClose={() => {
            setShowRuleDrawer(false);
            onResolvePendingRefresh?.();
          }}
          onSaved={() => {
            setShowRuleDrawer(false);
            onResolvePendingRefresh?.();
          }}
        />
      )}

      {isExpanded &&
        transaction.reimbursements.map((r) => (
          <ReimbursementSubRow
            key={r.id}
            reimbursement={r}
            colCount={colCount}
          />
        ))}
    </>
  );
}
