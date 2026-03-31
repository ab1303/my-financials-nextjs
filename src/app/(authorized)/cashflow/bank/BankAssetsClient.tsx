'use client';

import { useId, useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { SingleValue } from 'react-select';
import Select from 'react-select';
import { Disclosure } from '@headlessui/react';
import { FiChevronDown, FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import clsx from 'clsx';
import { NumericFormat } from 'react-number-format';
import { toast } from 'react-toastify';

import { trpc } from '@/server/trpc/client';
import type { CalendarYearType, OptionType } from '@/types';
import type {
  BankTotalSummary,
  AccountBalance,
  SnapshotTotals,
} from '@/types/bank-asset.types';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components';
import { Modal } from '@/components/ui/Modal';
import NewSnapshotModal from './NewSnapshotModal';
import { updateAccountName } from './actions';
import BankAssetAIImportWizard from './_components/BankAssetAIImportWizard';
import ImportAuditIcon from '../expense/_components/ai-import/ImportAuditIcon';

type CalendarType = 'FISCAL' | 'ANNUAL' | 'ZAKAT';

type InitialDataType = {
  calendarYears: Array<CalendarYearType>;
  selectedType: CalendarType;
  selectedCalendarYearId: string;
};

type Props = {
  initialData: InitialDataType;
};

export default function BankAssetsClient({ initialData }: Props) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();

  const [selectedType, setSelectedType] = useState<CalendarType>(
    initialData.selectedType,
  );

  // Memoize year options to prevent unnecessary re-renders
  const yearOptions: OptionType[] = useMemo(
    () =>
      initialData.calendarYears.map((cy) => ({
        id: cy.id,
        label: cy.description,
      })),
    [initialData.calendarYears],
  );

  // Initialize selectedYear from server-provided default
  const [selectedYear, setSelectedYear] = useState<SingleValue<OptionType>>(
    () => {
      if (initialData.selectedCalendarYearId && yearOptions.length > 0) {
        return (
          yearOptions.find(
            (opt) => opt.id === initialData.selectedCalendarYearId,
          ) || null
        );
      }
      return null;
    },
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAIImportOpen, setIsAIImportOpen] = useState(false);

  // Snapshot selection state
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(
    null,
  );

  // Edit entry state
  const [editingEntry, setEditingEntry] = useState<{
    entryId: string;
    accountId: string;
    bankId: string;
    accountName: string;
    balance: number;
  } | null>(null);
  const [editBalance, setEditBalance] = useState(0);
  const [editAccountName, setEditAccountName] = useState('');
  const [isEditingModalName, setIsEditingModalName] = useState(false);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    entryId: string;
    accountName: string;
    snapshotId: string;
  } | null>(null);

  // Edit account name state
  const [editingAccountName, setEditingAccountName] = useState<{
    accountId: string;
    bankId: string;
    currentName: string;
  } | null>(null);
  const [newAccountName, setNewAccountName] = useState('');
  const [accountNameError, setAccountNameError] = useState('');

  // Update selectedYear when initialData changes (e.g., type switch)
  useEffect(() => {
    if (initialData.selectedCalendarYearId && yearOptions.length > 0) {
      const selected = yearOptions.find(
        (opt) => opt.id === initialData.selectedCalendarYearId,
      );
      setSelectedYear(selected || null);
    } else if (yearOptions.length === 0) {
      setSelectedYear(null);
    }
  }, [initialData.selectedCalendarYearId, yearOptions]);

  // Get all snapshots for the selected calendar year (for history dropdown)
  // Only enable query when we have a valid selected year with an ID
  const { data: allSnapshots = [], isLoading: isLoadingSnapshots } =
    trpc.bankAsset.getSnapshots.useQuery(
      {
        calendarYearId: selectedYear?.id ?? '',
      },
      {
        enabled: !!selectedYear?.id,
        retry: 1,
      },
    );

  // Auto-select most recent snapshot when snapshots load
  useEffect(() => {
    if (allSnapshots.length > 0 && !selectedSnapshotId) {
      // Select the most recent snapshot
      const sorted = [...allSnapshots].sort(
        (a, b) =>
          new Date(b.snapshotDate).getTime() -
          new Date(a.snapshotDate).getTime(),
      );
      if (sorted[0]?.id) {
        setSelectedSnapshotId(sorted[0].id);
      }
    }
  }, [allSnapshots, selectedSnapshotId]);

  // Get the currently selected snapshot
  const snapshot = selectedSnapshotId
    ? allSnapshots.find((s) => s.id === selectedSnapshotId)
    : null;

  // Get totals if snapshot exists
  const { data: totals } = trpc.bankAsset.getSnapshotTotals.useQuery(
    {
      snapshotId: snapshot?.id || '',
    },
    {
      enabled: !!snapshot?.id,
    },
  ) as { data?: SnapshotTotals };

  // Fetch configured banks (from Business model, type=BANK)
  const { data: banks = [] } = trpc.business.getBusinessesByType.useQuery({
    type: 'BANK',
  });

  // Loading state - true only if query is actively fetching
  const isLoading = isLoadingSnapshots && !!selectedYear?.id;

  // Update entry mutation
  const updateEntryMutation = trpc.bankAsset.updateEntry.useMutation({
    onSuccess: () => {
      toast.success('Balance updated!');
      setEditingEntry(null);
      // Refetch snapshot data
      utils.bankAsset.getSnapshots.invalidate();
      utils.bankAsset.getMostRecentSnapshot.invalidate();
      utils.bankAsset.getSnapshotTotals.invalidate();
    },
    onError: (error) => {
      toast.error((error as any)?.message || 'Failed to update balance');
    },
  });

  // Delete entry mutation
  const deleteEntryMutation = trpc.bankAsset.deleteEntry.useMutation({
    onSuccess: () => {
      toast.success('Account removed!');
      setDeleteConfirm(null);
      // Refetch snapshot data
      utils.bankAsset.getSnapshots.invalidate();
      utils.bankAsset.getMostRecentSnapshot.invalidate();
      utils.bankAsset.getSnapshotTotals.invalidate();
    },
    onError: (error) => {
      toast.error((error as any)?.message || 'Failed to delete account');
    },
  });

  // Delete snapshot mutation
  const deleteSnapshotMutation = trpc.bankAsset.deleteSnapshot.useMutation({
    onSuccess: () => {
      toast.success('Snapshot deleted!');
      setSelectedSnapshotId(null);
      // Reset and refetch data
      utils.bankAsset.getSnapshots.invalidate();
      utils.bankAsset.getMostRecentSnapshot.invalidate();
      utils.bankAsset.getSnapshotTotals.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete snapshot');
    },
  });

  // Server action state for updating account name
  const [isUpdatingAccountName, setIsUpdatingAccountName] = useState(false);

  const handleTypeChange = (type: CalendarType) => {
    setSelectedType(type);
    setSelectedYear(null); // Clear selection when type changes
    const params = new URLSearchParams(searchParams?.toString());
    params.set('type', type);
    params.delete('yearId'); // Reset year when type changes
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleYearChange = (selected: SingleValue<OptionType>) => {
    setSelectedYear(selected);
    if (selected) {
      const params = new URLSearchParams(searchParams?.toString());
      params.set('yearId', selected.id);
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  const handleEditEntry = (
    entryId: string,
    accountId: string,
    bankId: string,
    accountName: string,
    balance: number,
  ) => {
    setEditingEntry({ entryId, accountId, bankId, accountName, balance });
    setEditBalance(balance);
    setEditAccountName(accountName);
    setIsEditingModalName(false);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;

    const nameChanged =
      editAccountName.trim() !== '' &&
      editAccountName.trim() !== editingEntry.accountName;

    // Update balance via tRPC mutation
    updateEntryMutation.mutate({
      entryId: editingEntry.entryId,
      balance: editBalance,
    });

    // Update account name via server action if changed
    if (nameChanged) {
      const result = await updateAccountName({
        accountId: editingEntry.accountId,
        name: editAccountName.trim(),
      });

      if (result.success) {
        toast.success('Account name updated!');
        // Invalidate queries to reflect the name change
        utils.bankAsset.getSnapshotTotals.invalidate();
        utils.bankAsset.getSnapshots.invalidate();
      } else {
        toast.error(result.error || 'Failed to update account name');
      }
    }
  };

  const handleDeleteEntry = (
    entryId: string,
    accountName: string,
    snapshotId: string,
  ) => {
    setDeleteConfirm({ entryId, accountName, snapshotId });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;

    deleteEntryMutation.mutate({
      entryId: deleteConfirm.entryId,
    });
  };

  const handleStartEditAccountName = (
    accountId: string,
    bankId: string,
    currentName: string,
  ) => {
    setEditingAccountName({ accountId, bankId, currentName });
    setNewAccountName(currentName);
    setAccountNameError('');
  };

  const handleSaveAccountName = async () => {
    if (!editingAccountName || !newAccountName.trim()) {
      setAccountNameError('Account name cannot be empty');
      return;
    }

    if (newAccountName === editingAccountName.currentName) {
      // No change, just close edit mode
      setEditingAccountName(null);
      return;
    }

    setIsUpdatingAccountName(true);
    try {
      const result = await updateAccountName({
        accountId: editingAccountName.accountId,
        name: newAccountName.trim(),
      });

      if (result.success) {
        toast.success('Account name updated!');
        setEditingAccountName(null);
        setNewAccountName('');
        setAccountNameError('');
        // Invalidate tRPC queries so account name refreshes in the UI
        utils.bankAsset.getSnapshotTotals.invalidate();
        utils.bankAsset.getSnapshots.invalidate();
      } else {
        setAccountNameError(result.error || 'Failed to update account name');
      }
    } finally {
      setIsUpdatingAccountName(false);
    }
  };

  const handleCancelEditAccountName = () => {
    setEditingAccountName(null);
    setNewAccountName('');
    setAccountNameError('');
  };

  const handleAccountNameKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === 'Enter') {
      handleSaveAccountName();
    } else if (e.key === 'Escape') {
      handleCancelEditAccountName();
    }
  };

  return (
    <div className='space-y-6'>
      {/* Calendar Year Selector */}
      <div className='space-y-4'>
        {/* Calendar Type Tabs */}
        <div>
          <Label htmlFor={`${id}-type`}>Calendar Type</Label>
          <div className='flex gap-2 mt-1'>
            {(['FISCAL', 'ANNUAL', 'ZAKAT'] as CalendarType[]).map((type) => (
              <button
                key={type}
                onClick={() => handleTypeChange(type)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  selectedType === type
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Year Dropdown */}
        <div>
          <Label htmlFor={`${id}-year`}>Calendar Year</Label>
          <Select
            id={`${id}-year`}
            instanceId={id}
            value={selectedYear}
            onChange={handleYearChange}
            options={yearOptions}
            getOptionValue={(option) => option.id}
            placeholder='Select year...'
            className='mt-1'
            isClearable
          />
        </div>

        {/* Snapshot Date Selector */}
        {allSnapshots.length > 0 && (
          <div>
            <Label htmlFor={`${id}-snapshot`}>Snapshot Date</Label>
            <select
              id={`${id}-snapshot`}
              value={selectedSnapshotId || ''}
              onChange={(e) => setSelectedSnapshotId(e.target.value)}
              className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500'
            >
              {[...allSnapshots]
                .sort(
                  (a: any, b: any) =>
                    new Date(b.snapshotDate).getTime() -
                    new Date(a.snapshotDate).getTime(),
                )
                .map((snap: any) => (
                  <option key={snap.id} value={snap.id}>
                    {new Date(snap.snapshotDate).toLocaleDateString('en-AU', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    {snap.id === allSnapshots[0]?.id && '(Most Recent)'}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      {/* Snapshot Date Display */}
      {snapshot && (
        <div className='flex items-center justify-between'>
          <div className='text-gray-600 font-medium'>
            Snapshot as of:{' '}
            {new Date(snapshot.snapshotDate).toLocaleDateString('en-AU', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </div>
          <button
            onClick={() =>
              setDeleteConfirm({
                snapshotId: snapshot.id,
                entryId: '',
                accountName: '',
              })
            }
            className='inline-flex items-center gap-2 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors'
          >
            <FiTrash2 size={16} />
            Delete Snapshot
          </button>
        </div>
      )}

      {/* Grand Total Card */}
      {totals && (
        <div className='bg-teal-50 border-2 border-teal-200 rounded-lg p-6'>
          <div className='text-sm font-medium text-teal-700 uppercase tracking-wide'>
            Total Cash Position
          </div>
          <div className='mt-2 text-3xl font-bold text-teal-900'>
            <NumericFormat
              value={Number(totals.grandTotal)}
              displayType='text'
              thousandSeparator=','
              prefix='$'
              decimalScale={2}
              fixedDecimalScale
            />
          </div>
        </div>
      )}

      {/* Bank Accordions */}
      {!selectedYear ? (
        <div className='text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300'>
          <p className='text-gray-600 mb-2'>
            {yearOptions.length === 0
              ? `No ${selectedType} calendar years available.`
              : 'Please select a calendar year to view bank assets.'}
          </p>
        </div>
      ) : isLoading ? (
        <div className='text-center py-8 text-gray-500'>
          Loading bank assets...
        </div>
      ) : banks.length === 0 ? (
        <div className='text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300'>
          <p className='text-gray-700 mb-4 font-medium'>
            You need to add banks first.
          </p>
          <p className='text-sm text-gray-600 mb-6'>
            Configure your banks in Settings before tracking cash assets.
          </p>
          <a
            href='/settings/banks'
            className='inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium'
          >
            Go to Settings → Banks
          </a>
        </div>
      ) : !totals || (totals && totals.banks.length === 0) ? (
        <div className='text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300'>
          <p className='text-gray-700 mb-4 font-medium'>
            No snapshots recorded.
          </p>
          <p className='text-sm text-gray-600 mb-6'>
            Take your first snapshot to start tracking your cash position.
          </p>
          <Button variant='primary' onClick={() => setIsModalOpen(true)}>
            <FiPlus className='mr-2' />
            New Snapshot
          </Button>
        </div>
      ) : totals ? (
        <div className='space-y-4'>
          {(totals as SnapshotTotals).banks.map((bank: BankTotalSummary) => (
            <Disclosure key={bank.bankId}>
              {({ open }) => (
                <div className='border border-gray-200 rounded-lg overflow-hidden'>
                  <Disclosure.Button className='flex justify-between items-center w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors'>
                    <div className='flex items-center gap-4'>
                      <FiChevronDown
                        className={clsx(
                          'w-5 h-5 text-gray-500 transition-transform',
                          open ? 'transform rotate-180' : '',
                        )}
                      />
                      <span className='text-lg font-semibold text-gray-900'>
                        {bank.bankName}
                      </span>
                    </div>
                    <div className='text-lg font-bold text-gray-900'>
                      <NumericFormat
                        value={Number(bank.total)}
                        displayType='text'
                        thousandSeparator=','
                        prefix='$'
                        decimalScale={2}
                        fixedDecimalScale
                      />
                    </div>
                  </Disclosure.Button>

                  <Disclosure.Panel className='px-6 py-4 bg-white'>
                    <div className='overflow-x-auto'>
                      <table className='min-w-full divide-y divide-gray-200'>
                        <thead className='bg-gray-50'>
                          <tr>
                            <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                              Account Name
                            </th>
                            <th className='px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                              Balance
                            </th>
                            <th className='px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className='bg-white divide-y divide-gray-200'>
                          {bank.accounts.map((account: AccountBalance) => {
                            // Find the entry ID from the snapshot entries
                            const snapshotEntry = snapshot?.entries.find(
                              (e) => e.accountId === account.accountId,
                            );
                            return (
                              <tr key={account.accountId}>
                                <td className='px-4 py-3 text-sm text-gray-900'>
                                  {editingAccountName?.accountId ===
                                  account.accountId ? (
                                    <div className='flex items-center gap-2'>
                                      <input
                                        type='text'
                                        value={newAccountName}
                                        onChange={(e) => {
                                          setNewAccountName(e.target.value);
                                          setAccountNameError('');
                                        }}
                                        onKeyDown={handleAccountNameKeyDown}
                                        autoFocus
                                        className='flex-1 px-2 py-1 border border-teal-500 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-600'
                                        placeholder='Account name'
                                      />
                                      <button
                                        onClick={handleSaveAccountName}
                                        disabled={isUpdatingAccountName}
                                        className='px-2 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50 transition-colors'
                                        title='Save'
                                      >
                                        ✓
                                      </button>
                                      <button
                                        onClick={handleCancelEditAccountName}
                                        disabled={isUpdatingAccountName}
                                        className='px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50 transition-colors'
                                        title='Cancel'
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <div className='flex items-center justify-between group'>
                                      <span>{account.accountName}</span>
                                      <button
                                        onClick={() =>
                                          handleStartEditAccountName(
                                            account.accountId,
                                            bank.bankId,
                                            account.accountName,
                                          )
                                        }
                                        className='ml-2 p-1 text-gray-400 opacity-40 group-hover:opacity-100 hover:text-gray-600 hover:bg-gray-100 rounded transition-all'
                                        aria-label={`Edit ${account.accountName}`}
                                        title='Edit account name'
                                      >
                                        <FiEdit2 className='w-4 h-4' />
                                      </button>
                                    </div>
                                  )}
                                  {accountNameError &&
                                    editingAccountName?.accountId ===
                                      account.accountId && (
                                      <p className='text-xs text-red-600 mt-1'>
                                        {accountNameError}
                                      </p>
                                    )}
                                </td>
                                <td className='px-4 py-3 text-sm text-right font-mono text-gray-900'>
                                  <NumericFormat
                                    value={Number(account.balance)}
                                    displayType='text'
                                    thousandSeparator=','
                                    prefix='$'
                                    decimalScale={2}
                                    fixedDecimalScale
                                  />
                                </td>
                                <td className='px-4 py-3 text-sm text-right'>
                                  <div className='flex justify-end gap-2'>
                                    <button
                                      onClick={() =>
                                        handleEditEntry(
                                          snapshotEntry?.id || '',
                                          account.accountId,
                                          bank.bankId,
                                          account.accountName,
                                          Number(account.balance),
                                        )
                                      }
                                      className='p-1 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded transition-colors'
                                      aria-label={`Edit ${account.accountName}`}
                                      title='Edit balance'
                                    >
                                      <FiEdit2 className='w-4 h-4' />
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleDeleteEntry(
                                          snapshotEntry?.id || '',
                                          account.accountName,
                                          snapshot?.id || '',
                                        )
                                      }
                                      className='p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors'
                                      aria-label={`Delete ${account.accountName}`}
                                      title='Delete account'
                                    >
                                      <FiTrash2 className='w-4 h-4' />
                                    </button>
                                    {snapshotEntry?.importImageId && (
                                      <ImportAuditIcon
                                        importImageId={
                                          snapshotEntry.importImageId
                                        }
                                        fileName={
                                          snapshotEntry.importImage?.fileName
                                        }
                                      />
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Disclosure.Panel>
                </div>
              )}
            </Disclosure>
          ))}
        </div>
      ) : null}

      {/* New Snapshot / AI Import Buttons (bottom) */}
      {totals && (totals as SnapshotTotals).banks.length > 0 && (
        <div className='flex justify-center gap-3 pt-4'>
          <Button variant='primary' onClick={() => setIsModalOpen(true)}>
            <FiPlus className='mr-2' />
            New Snapshot
          </Button>
          <Button
            variant='secondary'
            onClick={() => setIsAIImportOpen(true)}
            disabled={!selectedYear}
          >
            AI Import
          </Button>
        </div>
      )}

      {/* Bank Asset AI Import Wizard */}
      <BankAssetAIImportWizard
        isOpen={isAIImportOpen}
        onClose={() => setIsAIImportOpen(false)}
        onImportComplete={() => {
          setIsAIImportOpen(false);
          setSelectedSnapshotId(null);
          utils.bankAsset.getSnapshots.invalidate();
          utils.bankAsset.getMostRecentSnapshot.invalidate();
          utils.bankAsset.getSnapshotTotals.invalidate();
        }}
      />

      {/* New Snapshot Modal */}
      <NewSnapshotModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mostRecentSnapshot={snapshot as any}
        onSuccess={() => {
          setIsModalOpen(false);
          // Reset selected snapshot ID first so auto-selection can pick new one
          setSelectedSnapshotId(null);
          // Invalidate all snapshots queries to refetch from server
          utils.bankAsset.getSnapshots.invalidate();
        }}
      />

      {/* Edit Entry Modal */}
      <Modal show={!!editingEntry} onClose={() => setEditingEntry(null)}>
        <Modal.Header>
          <h2 className='text-xl font-semibold text-gray-900'>
            Edit Account Details
          </h2>
        </Modal.Header>

        <Modal.Body>
          <div className='space-y-4'>
            <div>
              <Label htmlFor='edit-account-name'>Account Name</Label>
              {isEditingModalName ? (
                <input
                  id='edit-account-name'
                  type='text'
                  value={editAccountName}
                  onChange={(e) => setEditAccountName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setIsEditingModalName(false);
                  }}
                  autoFocus
                  className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500'
                  placeholder='Account name'
                />
              ) : (
                <div
                  onClick={() => setIsEditingModalName(true)}
                  className='group mt-1 flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-300 cursor-pointer hover:border-teal-400 hover:bg-white transition-colors'
                >
                  <span className='text-gray-900'>{editAccountName}</span>
                  <FiEdit2 className='w-4 h-4 text-gray-400 opacity-40 group-hover:opacity-100 transition-opacity' />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor='edit-balance'>Balance</Label>
              <NumericFormat
                id='edit-balance'
                value={editBalance}
                onValueChange={(values) => {
                  setEditBalance(values.floatValue || 0);
                }}
                thousandSeparator=','
                prefix='$'
                decimalScale={2}
                fixedDecimalScale
                className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500'
              />
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button
            type='button'
            variant='secondary'
            onClick={() => setEditingEntry(null)}
          >
            Cancel
          </Button>
          <Button
            type='button'
            variant='primary'
            onClick={handleSaveEdit}
            disabled={updateEntryMutation.isPending}
          >
            {updateEntryMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <Modal.Header>
          <h2 className='text-xl font-semibold text-gray-900'>
            {deleteConfirm?.snapshotId && !deleteConfirm?.entryId
              ? 'Delete Entire Snapshot'
              : 'Delete Account'}
          </h2>
        </Modal.Header>

        <Modal.Body>
          <div className='space-y-4'>
            {deleteConfirm?.snapshotId && !deleteConfirm?.entryId ? (
              <>
                <p className='text-gray-700'>
                  Are you sure you want to delete the entire snapshot from{' '}
                  <span className='font-semibold'>
                    {snapshot &&
                      new Date(snapshot.snapshotDate).toLocaleDateString(
                        'en-AU',
                        {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        },
                      )}
                  </span>
                  ?
                </p>
                <p className='text-sm'>
                  This will delete{' '}
                  <span className='font-semibold'>
                    {snapshot?.entries.length}
                  </span>{' '}
                  account
                  {snapshot?.entries.length !== 1 ? 's' : ''} from this
                  snapshot.
                </p>
              </>
            ) : (
              <>
                <p className='text-gray-700'>
                  Are you sure you want to delete{' '}
                  <span className='font-semibold'>
                    {deleteConfirm?.accountName}
                  </span>{' '}
                  from this snapshot?
                </p>
              </>
            )}
            <p className='text-sm text-gray-500'>
              This action cannot be undone.
            </p>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button
            type='button'
            variant='secondary'
            onClick={() => setDeleteConfirm(null)}
          >
            Cancel
          </Button>
          <Button
            type='button'
            variant='primary'
            onClick={handleConfirmDelete}
            disabled={
              deleteEntryMutation.isPending || deleteSnapshotMutation.isPending
            }
            className='!bg-red-600 hover:!bg-red-700'
          >
            {deleteEntryMutation.isPending || deleteSnapshotMutation.isPending
              ? 'Deleting...'
              : deleteConfirm?.snapshotId && !deleteConfirm?.entryId
                ? 'Delete Snapshot'
                : 'Delete Account'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
