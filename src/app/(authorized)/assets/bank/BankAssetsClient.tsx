'use client';

import { useId, useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { SingleValue } from 'react-select';
import { AppSelect as Select } from '@/components/ui/AppSelect';
import { Disclosure } from '@headlessui/react';
import { ChevronDown, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import clsx from 'clsx';
import { NumericFormat } from 'react-number-format';
import { toast } from 'sonner';

import { trpc } from '@/server/trpc/client';
import type { CalendarYearType, OptionType } from '@/types';
import type {
  BankTotalSummary,
  AccountBalance,
  SnapshotTotals,
} from '@/types/bank-asset.types';
import { AppCreatableSelect } from '@/components/ui/AppCreatableSelect';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import NewSnapshotModal from './NewSnapshotModal';
import { updateAccountName } from './actions';
import BankAssetAIImportWizard from './_components/BankAssetAIImportWizard';
import ImportAuditIcon from '@/components/ImportAuditIcon';
import AIUsageCard from '@/components/AIUsageCard';

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
  const [addingEntryForBankId, setAddingEntryForBankId] = useState<string | null>(
    null,
  );
  const [newEntryAccountId, setNewEntryAccountId] = useState<string>('');
  const [newEntryBalance, setNewEntryBalance] = useState<number>(0);
  const [newEntryError, setNewEntryError] = useState<string>('');

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
  const { data: allBankAccounts = [] } = trpc.bankAsset.getBankAccounts.useQuery(
    {},
    { enabled: !!snapshot },
  );

  // Loading state - true only if query is actively fetching
  const isLoading = isLoadingSnapshots && !!selectedYear?.id;

  // Compute date range for AI usage card from selected calendar year
  const selectedCalendarYearFull = useMemo(() => {
    if (!selectedYear?.id) return null;
    return (
      initialData.calendarYears.find((cy) => cy.id === selectedYear.id) ?? null
    );
  }, [selectedYear, initialData.calendarYears]);

  const aiUsageDateRange = useMemo(() => {
    if (!selectedCalendarYearFull) return null;
    return {
      dateFrom: new Date(
        selectedCalendarYearFull.fromYear,
        selectedCalendarYearFull.fromMonth - 1,
        1,
      ),
      dateTo: new Date(
        selectedCalendarYearFull.toYear,
        selectedCalendarYearFull.toMonth,
        0,
        23,
        59,
        59,
      ),
      label: selectedCalendarYearFull.description,
    };
  }, [selectedCalendarYearFull]);

  const accountsAlreadyInSnapshot = useMemo(
    () => new Set(snapshot?.balanceRecords.map((r) => r.accountId) ?? []),
    [snapshot],
  );

  // Map bankId → BankTotalSummary for O(1) lookup during render
  const totalsMap = useMemo(
    () =>
      new Map(
        (totals as SnapshotTotals | undefined)?.banks.map((b) => [b.bankId, b]) ?? [],
      ),
    [totals],
  );

  const getAddableAccountsForBank = (bankId: string) =>
    allBankAccounts
      .filter((acc) => acc.institutionId === bankId && !accountsAlreadyInSnapshot.has(acc.id))
      .map((acc) => ({ value: acc.id, label: acc.name }));

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
      setDeleteConfirm(null);
      setSelectedSnapshotId(null);
      // Reset and refetch data
      utils.bankAsset.getSnapshots.invalidate();
      utils.bankAsset.getMostRecentSnapshot.invalidate();
      utils.bankAsset.getSnapshotTotals.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete snapshot');
      setDeleteConfirm(null);
      setSelectedSnapshotId(null);
      // Refetch in case of sync issues
      utils.bankAsset.getSnapshots.invalidate();
    },
  });

  const createAccountForEntryMutation = trpc.bankAsset.createBankAccount.useMutation({
    onSuccess: () => {
      utils.bankAsset.getBankAccounts.invalidate();
    },
    onError: (error) => {
      toast.error((error as any)?.message || 'Failed to create account');
    },
  });

  const addEntryToSnapshotMutation = trpc.bankAsset.addEntryToSnapshot.useMutation({
    onSuccess: () => {
      toast.success('Account added to snapshot!');
      setAddingEntryForBankId(null);
      setNewEntryAccountId('');
      setNewEntryBalance(0);
      setNewEntryError('');
      utils.bankAsset.getSnapshots.invalidate();
      utils.bankAsset.getMostRecentSnapshot.invalidate();
      utils.bankAsset.getSnapshotTotals.invalidate();
    },
    onError: (error: any) => {
      const msg: string = error?.message || 'Failed to add account to snapshot';
      if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('already')) {
        setNewEntryError('This account is already in the snapshot.');
      } else {
        toast.error(msg);
      }
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

    if (deleteConfirm.snapshotId && !deleteConfirm.entryId) {
      // Delete entire snapshot
      deleteSnapshotMutation.mutate({
        snapshotId: deleteConfirm.snapshotId,
      });
    } else {
      // Delete entry
      deleteEntryMutation.mutate({
        entryId: deleteConfirm.entryId,
      });
    }
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

  const handleOpenAddEntry = (bankId: string) => {
    setAddingEntryForBankId(bankId);
    setNewEntryAccountId('');
    setNewEntryBalance(0);
    setNewEntryError('');
  };

  const handleCancelAddEntry = () => {
    setAddingEntryForBankId(null);
    setNewEntryAccountId('');
    setNewEntryBalance(0);
    setNewEntryError('');
  };

  const handleSaveAddEntry = () => {
    if (!snapshot || !addingEntryForBankId) return;
    if (!newEntryAccountId) {
      setNewEntryError('Please select or create an account.');
      return;
    }
    setNewEntryError('');
    addEntryToSnapshotMutation.mutate({
      snapshotId: snapshot.id,
      accountId: newEntryAccountId,
      balance: newEntryBalance,
    });
  };

  const handleCreateAccountForEntry = async (
    bankId: string,
    accountName: string,
  ): Promise<string> => {
    const result = await createAccountForEntryMutation.mutateAsync({
      name: accountName,
      bankId,
    });
    if (!result?.data?.account?.id) throw new Error('Failed to create account');
    return result.data.account.id;
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
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
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
          <Select<OptionType>
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
              className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring'
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

      {/* AI Usage Card */}
      {aiUsageDateRange && (
        <AIUsageCard
          importType='BANK_ASSET'
          dateFrom={aiUsageDateRange.dateFrom}
          dateTo={aiUsageDateRange.dateTo}
          dateLabel={aiUsageDateRange.label}
        />
      )}

      {/* Snapshot Date Display */}
      {snapshot && (
        <div className='flex items-center justify-between'>
          <div className='text-muted-foreground font-medium'>
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
            <Trash2 className='w-4 h-4' />
            Delete Snapshot
          </button>
        </div>
      )}

      {/* Grand Total Card */}
      {totals && (
        <div className='bg-primary/10 border-2 border-primary/30 rounded-lg p-6'>
          <div className='text-sm font-medium text-primary uppercase tracking-wide'>
            Total Cash Position
          </div>
          <div className='mt-2 text-3xl font-bold text-foreground'>
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
        <div className='text-center py-12 bg-muted/50 rounded-lg border-2 border-dashed border-border'>
          <p className='text-muted-foreground mb-2'>
            {yearOptions.length === 0
              ? `No ${selectedType} calendar years available.`
              : 'Please select a calendar year to view bank assets.'}
          </p>
        </div>
      ) : isLoading ? (
        <div className='text-center py-8 text-muted-foreground'>
          Loading bank assets...
        </div>
      ) : banks.length === 0 ? (
        <div className='text-center py-12 bg-muted/50 rounded-lg border-2 border-dashed border-border'>
          <p className='text-foreground mb-4 font-medium'>
            You need to add banks first.
          </p>
          <p className='text-sm text-muted-foreground mb-6'>
            Configure your banks in Settings before tracking cash assets.
          </p>
          <a
            href='/settings/banks'
            className='inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium'
          >
            Go to Settings → Banks
          </a>
        </div>
      ) : !snapshot ? (
        <div className='text-center py-12 bg-muted/50 rounded-lg border-2 border-dashed border-border'>
          <p className='text-foreground mb-4 font-medium'>
            No snapshots recorded.
          </p>
          <p className='text-sm text-muted-foreground mb-6'>
            Take your first snapshot to start tracking your cash position.
          </p>
          <Button variant='default' onClick={() => setIsModalOpen(true)}>
            <Plus className='mr-2 w-4 h-4' />
            New Snapshot
          </Button>
        </div>
      ) : snapshot ? (
        <div className='space-y-4'>
          {banks.map((bank) => {
            const bankTotals = totalsMap.get(bank.id);
            const hasBankAccounts = allBankAccounts.some((a) => a.institutionId === bank.id);
            return (
              <Disclosure key={bank.id}>
                {({ open }) => (
                  <div className='border border-border rounded-lg overflow-hidden'>
                    <Disclosure.Button className='flex justify-between items-center w-full px-6 py-4 bg-muted/50 hover:bg-muted transition-colors'>
                      <div className='flex items-center gap-4'>
                        <ChevronDown
                          className={clsx(
                            'w-5 h-5 text-muted-foreground transition-transform',
                            open ? 'transform rotate-180' : '',
                          )}
                        />
                        <span className='text-lg font-semibold text-foreground'>
                          {bank.name}
                        </span>
                      </div>
                      <div className='text-lg font-bold text-foreground'>
                        {bankTotals ? (
                          <NumericFormat
                            value={Number(bankTotals.total)}
                            displayType='text'
                            thousandSeparator=','
                            prefix='$'
                            decimalScale={2}
                            fixedDecimalScale
                          />
                        ) : (
                          <span className='text-sm font-normal text-muted-foreground'>
                            Not tracked
                          </span>
                        )}
                      </div>
                    </Disclosure.Button>

                    <Disclosure.Panel className='px-6 py-4 bg-card'>
                      {bankTotals ? (
                        <>
                          <div className='overflow-x-auto'>
                            <table className='min-w-full divide-y divide-border'>
                              <thead className='bg-muted/50'>
                                <tr>
                                  <th className='px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                                    Account Name
                                  </th>
                                  <th className='px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                                    Balance
                                  </th>
                                  <th className='px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody className='bg-card divide-y divide-border'>
                                {bankTotals.accounts.map((account: AccountBalance) => {
                                  const snapshotEntry = snapshot?.balanceRecords.find(
                                    (e) => e.accountId === account.accountId,
                                  );
                                  return (
                                    <tr key={account.accountId}>
                                      <td className='px-4 py-3 text-sm text-foreground'>
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
                                              className='flex-1 px-2 py-1 border border-ring rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring'
                                              placeholder='Account name'
                                            />
                                            <button
                                              onClick={handleSaveAccountName}
                                              disabled={isUpdatingAccountName}
                                              className='px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 transition-colors'
                                              title='Save'
                                            >
                                              <Check className='w-3 h-3' />
                                            </button>
                                            <button
                                              onClick={handleCancelEditAccountName}
                                              disabled={isUpdatingAccountName}
                                              className='px-2 py-1 text-xs bg-muted text-muted-foreground rounded hover:bg-muted/80 disabled:opacity-50 transition-colors'
                                              title='Cancel'
                                            >
                                              <X className='w-3 h-3' />
                                            </button>
                                          </div>
                                        ) : (
                                          <div className='flex items-center justify-between group'>
                                            <span>{account.accountName}</span>
                                            <button
                                              onClick={() =>
                                                handleStartEditAccountName(
                                                  account.accountId,
                                                  bankTotals.bankId,
                                                  account.accountName,
                                                )
                                              }
                                              className='ml-2 p-1 text-muted-foreground opacity-40 group-hover:opacity-100 hover:text-foreground hover:bg-muted rounded transition-all'
                                              aria-label={`Edit ${account.accountName}`}
                                              title='Edit account name'
                                            >
                                              <Pencil className='w-4 h-4' />
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
                                      <td className='px-4 py-3 text-sm text-right font-mono text-foreground'>
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
                                                bankTotals.bankId,
                                                account.accountName,
                                                Number(account.balance),
                                              )
                                            }
                                            className='p-1 text-primary hover:text-primary/80 hover:bg-primary/10 rounded transition-colors'
                                            aria-label={`Edit ${account.accountName}`}
                                            title='Edit balance'
                                          >
                                            <Pencil className='w-4 h-4' />
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
                                            <Trash2 className='w-4 h-4' />
                                          </button>
                                          {snapshotEntry?.importImageId && (
                                            <ImportAuditIcon
                                              importImageId={snapshotEntry.importImageId}
                                              fileName={snapshotEntry.importImage?.fileName}
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
                          {addingEntryForBankId === bank.id ? (
                            <div className='mt-3 p-3 border border-dashed border-border rounded-lg bg-muted/30'>
                              <div className='flex flex-col gap-3 sm:flex-row sm:items-end'>
                                <div className='flex-1'>
                                  <label className='block text-xs font-medium text-muted-foreground mb-1'>
                                    Account
                                  </label>
                                  <AppCreatableSelect
                                    inputId={`add-entry-account-${bank.id}`}
                                    options={getAddableAccountsForBank(bank.id)}
                                    value={
                                      newEntryAccountId
                                        ? {
                                            value: newEntryAccountId,
                                            label:
                                              allBankAccounts.find(
                                                (a) => a.id === newEntryAccountId,
                                              )?.name ?? newEntryAccountId,
                                          }
                                        : null
                                    }
                                    onChange={(option) => {
                                      setNewEntryAccountId(option?.value ?? '');
                                      setNewEntryError('');
                                    }}
                                    onCreateOption={(inputValue) => {
                                      handleCreateAccountForEntry(bank.id, inputValue)
                                        .then((newAccountId) => {
                                          setNewEntryAccountId(newAccountId);
                                          toast.success(`Account "${inputValue}" created!`);
                                        })
                                        .catch(() => {});
                                    }}
                                    isClearable
                                    placeholder='Select or type to create...'
                                    isLoading={createAccountForEntryMutation.isPending}
                                  />
                                </div>
                                <div className='w-40'>
                                  <label className='block text-xs font-medium text-muted-foreground mb-1'>
                                    Balance
                                  </label>
                                  <NumericFormat
                                    value={newEntryBalance}
                                    onValueChange={(values) =>
                                      setNewEntryBalance(values.floatValue ?? 0)
                                    }
                                    thousandSeparator=','
                                    prefix='$'
                                    decimalScale={2}
                                    fixedDecimalScale
                                    className='w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring'
                                  />
                                </div>
                                <div className='flex gap-2'>
                                  <Button
                                    type='button'
                                    variant='default'
                                    onClick={handleSaveAddEntry}
                                    disabled={addEntryToSnapshotMutation.isPending}
                                  >
                                    <Check className='w-4 h-4 mr-1' />
                                    {addEntryToSnapshotMutation.isPending ? 'Adding...' : 'Add'}
                                  </Button>
                                  <Button
                                    type='button'
                                    variant='secondary'
                                    onClick={handleCancelAddEntry}
                                    disabled={addEntryToSnapshotMutation.isPending}
                                  >
                                    <X className='w-4 h-4 mr-1' />
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                              {newEntryError && (
                                <p className='mt-2 text-xs text-red-600'>{newEntryError}</p>
                              )}
                            </div>
                          ) : (
                            <div className='mt-3 flex justify-end'>
                              <Button
                                type='button'
                                variant='secondary'
                                onClick={() => handleOpenAddEntry(bank.id)}
                              >
                                <Plus className='w-4 h-4 mr-1' />
                                Add Account
                              </Button>
                            </div>
                          )}
                        </>
                      ) : addingEntryForBankId === bank.id ? (
                        <div className='p-3 border border-dashed border-border rounded-lg bg-muted/30'>
                          <div className='flex flex-col gap-3 sm:flex-row sm:items-end'>
                            <div className='flex-1'>
                              <label className='block text-xs font-medium text-muted-foreground mb-1'>
                                Account
                              </label>
                              <AppCreatableSelect
                                inputId={`add-entry-account-${bank.id}`}
                                options={getAddableAccountsForBank(bank.id)}
                                value={
                                  newEntryAccountId
                                    ? {
                                        value: newEntryAccountId,
                                        label:
                                          allBankAccounts.find(
                                            (a) => a.id === newEntryAccountId,
                                          )?.name ?? newEntryAccountId,
                                      }
                                    : null
                                }
                                onChange={(option) => {
                                  setNewEntryAccountId(option?.value ?? '');
                                  setNewEntryError('');
                                }}
                                onCreateOption={(inputValue) => {
                                  handleCreateAccountForEntry(bank.id, inputValue)
                                    .then((newAccountId) => {
                                      setNewEntryAccountId(newAccountId);
                                      toast.success(`Account "${inputValue}" created!`);
                                    })
                                    .catch(() => {});
                                }}
                                isClearable
                                placeholder='Select or type to create...'
                                isLoading={createAccountForEntryMutation.isPending}
                              />
                            </div>
                            <div className='w-40'>
                              <label className='block text-xs font-medium text-muted-foreground mb-1'>
                                Balance
                              </label>
                              <NumericFormat
                                value={newEntryBalance}
                                onValueChange={(values) =>
                                  setNewEntryBalance(values.floatValue ?? 0)
                                }
                                thousandSeparator=','
                                prefix='$'
                                decimalScale={2}
                                fixedDecimalScale
                                className='w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring'
                              />
                            </div>
                            <div className='flex gap-2'>
                              <Button
                                type='button'
                                variant='default'
                                onClick={handleSaveAddEntry}
                                disabled={addEntryToSnapshotMutation.isPending}
                              >
                                <Check className='w-4 h-4 mr-1' />
                                {addEntryToSnapshotMutation.isPending ? 'Adding...' : 'Add'}
                              </Button>
                              <Button
                                type='button'
                                variant='secondary'
                                onClick={handleCancelAddEntry}
                                disabled={addEntryToSnapshotMutation.isPending}
                              >
                                <X className='w-4 h-4 mr-1' />
                                Cancel
                              </Button>
                            </div>
                          </div>
                          {newEntryError && (
                            <p className='mt-2 text-xs text-red-600'>{newEntryError}</p>
                          )}
                        </div>
                      ) : (
                        <div className='py-6 flex flex-col items-center gap-3 text-center'>
                          {hasBankAccounts ? (
                            <>
                              <p className='text-sm text-muted-foreground'>
                                No accounts tracked in this snapshot.
                              </p>
                              <Button
                                type='button'
                                variant='secondary'
                                onClick={() => handleOpenAddEntry(bank.id)}
                              >
                                <Plus className='w-4 h-4 mr-1' />
                                Add Account
                              </Button>
                            </>
                          ) : (
                            <p className='text-sm text-muted-foreground'>
                              No accounts configured for this bank.{' '}
                              <a
                                href='/settings/banks'
                                className='underline text-primary hover:text-primary/80'
                              >
                                Add in Settings
                              </a>
                            </p>
                          )}
                        </div>
                      )}
                    </Disclosure.Panel>
                  </div>
                )}
              </Disclosure>
            );
          })}
        </div>
      ) : null}

      {/* New Snapshot / AI Import Buttons (bottom) */}
      {snapshot && (
        <div className='flex justify-center gap-3 pt-4'>
          <Button variant='default' onClick={() => setIsModalOpen(true)}>
            <Plus className='mr-2 w-4 h-4' />
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
          <span className='text-xl font-semibold text-foreground'>
            Edit Account Details
          </span>
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
                  className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring'
                  placeholder='Account name'
                />
              ) : (
                <div
                  onClick={() => setIsEditingModalName(true)}
                  className='group mt-1 flex items-center justify-between px-3 py-2 bg-muted/50 rounded-lg border border-input cursor-pointer hover:border-primary/50 hover:bg-background transition-colors'
                >
                  <span className='text-foreground'>{editAccountName}</span>
                  <Pencil className='w-4 h-4 text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity' />
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
                className='mt-1 block w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring'
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
            variant='default'
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
          <span className='text-xl font-semibold text-foreground'>
            {deleteConfirm?.snapshotId && !deleteConfirm?.entryId
              ? 'Delete Entire Snapshot'
              : 'Delete Account'}
          </span>
        </Modal.Header>

        <Modal.Body>
          <div className='space-y-4'>
            {deleteConfirm?.snapshotId && !deleteConfirm?.entryId ? (
              <>
                <p className='text-foreground'>
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
                    {snapshot?.balanceRecords.length}
                  </span>{' '}
                  account
                  {snapshot?.balanceRecords.length !== 1 ? 's' : ''} from this
                  snapshot.
                </p>
              </>
            ) : (
              <>
                <p className='text-foreground'>
                  Are you sure you want to delete{' '}
                  <span className='font-semibold'>
                    {deleteConfirm?.accountName}
                  </span>{' '}
                  from this snapshot?
                </p>
              </>
            )}
            <p className='text-sm text-muted-foreground'>
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
            variant='destructive'
            onClick={handleConfirmDelete}
            disabled={
              deleteEntryMutation.isPending || deleteSnapshotMutation.isPending
            }
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
