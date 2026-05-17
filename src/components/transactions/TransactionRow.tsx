'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import clsx from 'clsx';
import AsyncSelect from 'react-select/async';
import Select from 'react-select';
import type { SingleValue } from 'react-select';
import { REIMBURSEMENT_CATEGORY, TRANSFER_CATEGORY } from '@/server/services/transactions/constants';
import { trpc } from '@/server/trpc/client';
import type { TransactionRow as LedgerTransactionRow } from '@/server/trpc/router/transaction-ledger';
import { getCompactSelectStyles } from '@/lib/select-styles';
import TransactionSourceIndicator from './TransactionSourceIndicator';
import ReimbursementSubRow from './ReimbursementSubRow';
import VoidTransactionButton from './VoidTransactionButton';
import RestoreTransactionButton from './RestoreTransactionButton';
import { UnlinkTransferButton } from './UnlinkTransferButton';

interface TransactionRowProps {
  transaction: LedgerTransactionRow;
  expenseCategories: Array<{ id: string; name: string }>;
  incomeSourceLabels: string[];
  onCategoryChange: (
    id: string,
    newCategory: string,
    offsetCategory?: string,
    offsetTransactionId?: string | null,
  ) => void;
  isSaving?: boolean;
  colCount?: number;
  onVoided?: () => void;
  onRestored?: () => void;
  onLinkTransfer?: () => void;
  onUnlinked?: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
}

type CategoryOption = {
  label: string;
  value: string;
};

type LinkOption = {
  label: string;
  value: string;
  meta: string;
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
}: TransactionRowProps) {
  const statusClasses: Record<string, string> = {
    CONFIRMED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    EXCLUDED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    VOIDED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };

  const [localCategory, setLocalCategory] = useState(transaction.category);
  const [localOffsetCategory, setLocalOffsetCategory] = useState(transaction.offsetCategory ?? '');
  const [isExpanded, setIsExpanded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [localOffsetTxId, setLocalOffsetTxId] = useState<string | null>(transaction.offsetTransactionId ?? null);
  const [selectedLinkOption, setSelectedLinkOption] = useState<LinkOption | null>(null);
  const categorySelectId = useId();
  const offsetCategorySelectId = useId();
  const linkSelectId = useId();
  const utils = trpc.useUtils();

  useEffect(() => {
    setLocalCategory(transaction.category);
  }, [transaction.category]);

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
          },
    );
  }, [transaction.offsetTransactionId]);

  const amountClass = transaction.type === 'DEBIT' ? 'text-red-600' : 'text-green-600';
  const options = transaction.type === 'DEBIT' ? expenseCategories : incomeSourceLabels;

  const showReimbursementOption =
    transaction.type === 'CREDIT' &&
    (transaction.status === 'EXCLUDED' ||
      transaction.category === REIMBURSEMENT_CATEGORY ||
      localCategory === REIMBURSEMENT_CATEGORY);

  // Transfer is a special system category valid for any transaction;
  // show it when the row is currently Transfer, or when it's EXCLUDED (so the user can restore it).
  const showTransferOption =
    transaction.category === TRANSFER_CATEGORY ||
    localCategory === TRANSFER_CATEGORY ||
    transaction.status === 'EXCLUDED';

  const categoryOptions = useMemo<CategoryOption[]>(
    () => [
      ...options.map((option) =>
        typeof option === 'string'
          ? { label: option, value: option }
          : { label: option.name, value: option.name },
      ),
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
    () => expenseCategories.map((category) => ({ label: category.name, value: category.name })),
    [expenseCategories],
  );

  const selectedCategory =
    categoryOptions.find((option) => option.value === localCategory) ?? null;

  const selectedOffsetCategory =
    offsetCategoryOptions.find((option) => option.value === localOffsetCategory) ?? null;
  const compactSelectStyles = getCompactSelectStyles<CategoryOption>();
  const linkSelectStyles = getCompactSelectStyles<LinkOption>();

  const totalReimbursed = transaction.reimbursements.reduce((sum, reimbursement) => sum + reimbursement.amount, 0);
  const netAmount = transaction.amount - totalReimbursed;
  const hasReimbursements = transaction.reimbursements.length > 0;

  const loadLinkOptions = useCallback(
    async (inputValue: string): Promise<LinkOption[]> => {
      const matches = await utils.transactionLedger.searchDebitTransactions.fetch({
        search: inputValue.trim() || undefined,
        limit: 10,
      });

      return matches.map((match) => ({
        value: match.id,
        label: match.description,
        meta: `${match.date} · ${formatCurrency(match.amount)}`,
      }));
    },
    [utils],
  );

  function handleChange(newCategory: string) {
    setLocalCategory(newCategory);
    if (newCategory !== REIMBURSEMENT_CATEGORY) {
      setLocalOffsetCategory('');
      onCategoryChange(transaction.id, newCategory);
    }
  }

  function handleOffsetChange(newOffsetCategory: string) {
    setLocalOffsetCategory(newOffsetCategory);
    onCategoryChange(transaction.id, REIMBURSEMENT_CATEGORY, newOffsetCategory, localOffsetTxId);
  }

  function handleLinkTransaction(linkedOption: LinkOption | null) {
    const linkedId = linkedOption?.value ?? null;
    setSelectedLinkOption(linkedOption);
    setLocalOffsetTxId(linkedId);
    setPickerOpen(false);
    onCategoryChange(transaction.id, REIMBURSEMENT_CATEGORY, localOffsetCategory || undefined, linkedId);
  }

  function handleResetLinkPicker() {
    setPickerOpen(false);
  }

  const formatLinkOptionLabel = (option: LinkOption) => (
    <div className="flex w-full items-center justify-between gap-3">
      <span className="truncate">{option.label}</span>
      <span className="shrink-0 tabular-nums text-xs text-gray-500 dark:text-gray-400">{option.meta}</span>
    </div>
  );

  return (
    <>
      <tr className="border-b border-gray-200 dark:border-gray-700">
        <td className="w-8 px-1 py-3 text-center">
          {hasReimbursements && (
            <button
              type="button"
              aria-label={isExpanded ? 'Collapse reimbursements' : 'Expand reimbursements'}
              onClick={() => setIsExpanded((v) => !v)}
              className="text-gray-400 transition-colors hover:text-teal-500"
            >
              {isExpanded ? '▾' : '▸'}
            </button>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{transaction.date.slice(0, 10)}</td>
        <td className="max-w-[240px] px-4 py-3 text-sm text-gray-900 dark:text-white">
          <span className="block truncate" title={transaction.description}>
            {transaction.description}
          </span>
        </td>
        <td className={`px-4 py-3 text-sm font-medium tabular-nums ${amountClass}`}>
          <div className="flex flex-col">
            <span>{formatCurrency(transaction.amount)}</span>
            {hasReimbursements && <span className="text-xs text-teal-600 dark:text-teal-400">net {formatCurrency(netAmount)}</span>}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{transaction.type}</td>
        <td className="px-4 py-3">
          <div className="flex flex-col gap-1">
            <Select
              instanceId={categorySelectId}
              inputId={categorySelectId}
              aria-label={`Category for ${transaction.description}`}
              isDisabled={isSaving}
              isClearable={false}
              value={selectedCategory}
              options={categoryOptions}
              onChange={(option: SingleValue<CategoryOption>) => handleChange(option?.value ?? '')}
              styles={{
                ...compactSelectStyles,
                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
              }}
              className="w-full min-w-[140px]"
              menuPortalTarget={document.body}
              menuPosition="fixed"
            />

            {localCategory === REIMBURSEMENT_CATEGORY && (
              <>
                <Select
                  instanceId={offsetCategorySelectId}
                  inputId={offsetCategorySelectId}
                  aria-label={`Offsets expense category for ${transaction.description}`}
                  isDisabled={isSaving}
                  isClearable={false}
                  placeholder="Offsets category…"
                  value={selectedOffsetCategory}
                  options={offsetCategoryOptions}
                  onChange={(option: SingleValue<CategoryOption>) => handleOffsetChange(option?.value ?? '')}
                  styles={{
                    ...compactSelectStyles,
                    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                  }}
                  className="w-full min-w-[140px]"
                  menuPortalTarget={document.body}
                  menuPosition="fixed"
                />

                <div className="mt-1">
                  {localOffsetTxId ? (
                    <div className="flex items-center gap-1 rounded border border-teal-300 bg-teal-50 px-2 py-1 text-xs dark:border-teal-700 dark:bg-teal-950/30">
                      <span className="text-teal-500">🔗</span>
                      <span className="truncate text-teal-700 dark:text-teal-300">
                        {selectedLinkOption?.label ?? 'Linked expense'}
                      </span>
                      <button
                        type="button"
                        aria-label="Unlink expense"
                        onClick={() => handleLinkTransaction(null)}
                        className="ml-auto text-gray-400 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </div>
                  ) : !pickerOpen ? (
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      className="text-xs text-teal-600 hover:underline dark:text-teal-400"
                    >
                      ＋ Link to original expense
                    </button>
                  ) : (
                    <div className="flex flex-col gap-1">
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
                        menuPosition="fixed"
                        placeholder="Search expenses…"
                        loadOptions={loadLinkOptions}
                        value={selectedLinkOption}
                        getOptionValue={(option) => option.value}
                        formatOptionLabel={formatLinkOptionLabel}
                        onChange={(option: SingleValue<LinkOption>) => handleLinkTransaction(option ?? null)}
                        styles={{
                          ...linkSelectStyles,
                          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                        }}
                        className="w-full min-w-[280px]"
                        noOptionsMessage={({ inputValue }) =>
                          inputValue.trim() ? 'No matching expenses' : 'Type to search expenses'
                        }
                      />
                      <button
                        type="button"
                        onClick={handleResetLinkPicker}
                        className="mt-1 text-xs text-gray-400 hover:text-gray-600"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300">
          <TransactionSourceIndicator source={transaction.source} />
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-col gap-1">
            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClasses[transaction.status] ?? statusClasses.EXCLUDED}`}>
              {transaction.status}
            </span>
            {transaction.category === REIMBURSEMENT_CATEGORY && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-900/30 dark:text-teal-300">
                ↩ {transaction.offsetCategory ?? 'Reimbursement'}
              </span>
            )}
            {transaction.category.toLowerCase() === 'gifts & donations' && transaction.type === 'DEBIT' && (
              <span
                className={clsx(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  transaction.isDonationLinked
                    ? 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
                )}
              >
                {transaction.isDonationLinked ? '🔗 Linked' : '⚠️ Needs recipient'}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
          {transaction.bankAccountName
            ? `${transaction.bankAccountName}${transaction.bankName ? ` (${transaction.bankName})` : ''}`
            : transaction.bankName ?? '-'}
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {transaction.status !== 'VOIDED' && onVoided && (
              <VoidTransactionButton transactionId={transaction.id} onVoided={onVoided} status={transaction.status} />
            )}
            {transaction.status === 'VOIDED' && onRestored && (
              <RestoreTransactionButton transactionId={transaction.id} onRestored={onRestored} />
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
                type="button"
                onClick={onLinkTransfer}
                className="rounded px-2 py-1 text-xs font-medium text-teal-600 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-900/20"
                title="Link as Transfer"
              >
                Link
              </button>
              )}
          </div>
        </td>
      </tr>

      {isExpanded && transaction.reimbursements.map((r) => <ReimbursementSubRow key={r.id} reimbursement={r} colCount={colCount} />)}
    </>
  );
}
