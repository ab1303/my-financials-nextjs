'use client';

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { NumericFormat } from 'react-number-format';
import { toast } from 'sonner';
import CreatableSelect from 'react-select/creatable';

import { trpc } from '@/server/trpc/client';
import { Modal } from '@/components/ui/Modal';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components';

type BankAssetEntry = {
  id: string;
  balance: string | number;
  account: {
    id: string;
    name: string;
    bankId: string;
  };
};

type BankAssetSnapshot = {
  id: string;
  snapshotDate: Date | string;
  balanceRecords: BankAssetEntry[];
};

type NewSnapshotModalProps = {
  isOpen: boolean;
  onClose: () => void;
  mostRecentSnapshot?: any;
  onSuccess: () => void;
};

type EntryType = {
  bankId: string;
  accountId: string;
  balance: number;
};

export default function NewSnapshotModal({
  isOpen,
  onClose,
  mostRecentSnapshot,
  onSuccess,
}: NewSnapshotModalProps) {
  const utils = trpc.useUtils();
  const [snapshotDate, setSnapshotDate] = useState<string>(() => {
    const today = new Date().toISOString().split('T')[0];
    return today || new Date().toISOString().substring(0, 10);
  });
  const [entries, setEntries] = useState<EntryType[]>([]);

  // Fetch banks (type=BANK) - only when modal is open
  const { data: banks = [] } = trpc.business.getBusinessesByType.useQuery(
    {
      type: 'BANK',
    },
    {
      enabled: isOpen,
    },
  );

  // Fetch all user's bank accounts - only when modal is open
  const { data: userAccounts = [] } = trpc.bankAsset.getBankAccounts.useQuery(
    {},
    {
      enabled: isOpen,
    },
  );

  // Create bank account mutation
  const createAccountMutation = trpc.bankAsset.createBankAccount.useMutation({
    onSuccess: () => {
      // Refetch accounts after creating new account
      utils.bankAsset.getBankAccounts.invalidate();
    },
    onError: (error) => {
      toast.error((error as any)?.message || 'Failed to create account');
    },
  });

  // Create snapshot mutation
  const createSnapshotMutation = trpc.bankAsset.createSnapshot.useMutation({
    onSuccess: () => {
      toast.success('Snapshot created successfully!');
      onSuccess();
    },
    onError: (error) => {
      toast.error((error as any)?.message || 'Failed to create snapshot');
    },
  });

  // Pre-fill form with most recent snapshot data
  useEffect(() => {
    if (mostRecentSnapshot?.entries && entries.length === 0) {
      const snapshotEntries = mostRecentSnapshot.balanceRecords.map((entry: any) => ({
        bankId: entry.account.bankId,
        accountId: entry.account.id,
        balance: Number(entry.balance),
      }));
      setEntries(snapshotEntries);
    }
  }, [mostRecentSnapshot, entries.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (entries.length === 0) {
      toast.error('Please add at least one account entry');
      return;
    }

    // Validate all entries have bankId and accountId
    const validEntries = entries.every((e) => e.bankId && e.accountId);
    if (!validEntries) {
      toast.error('Please select a bank and account for all entries');
      return;
    }

    createSnapshotMutation.mutate({
      snapshotDate: new Date(snapshotDate),
      entries: entries.map((e) => ({
        accountId: e.accountId,
        balance: e.balance,
      })),
    });
  };

  const handleAddEntry = () => {
    setEntries([...entries, { bankId: '', accountId: '', balance: 0 }]);
  };

  const handleRemoveEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const handleEntryChange = (
    index: number,
    field: 'bankId' | 'accountId' | 'balance',
    value: string | number,
  ) => {
    const newEntries = [...entries];
    if (field === 'bankId') {
      newEntries[index]!.bankId = value as string;
      // Reset account when bank changes
      newEntries[index]!.accountId = '';
    } else if (field === 'accountId') {
      newEntries[index]!.accountId = value as string;
    } else {
      newEntries[index]!.balance = value as number;
    }
    setEntries(newEntries);
  };

  // Handle creating a new account
  const handleCreateAccount = async (
    bankId: string,
    accountName: string,
  ): Promise<string> => {
    try {
      const result = await createAccountMutation.mutateAsync({
        name: accountName,
        bankId,
      });
      if (!result?.data?.account?.id) {
        throw new Error('Failed to create account');
      }
      return result.data.account.id;
    } catch (error) {
      // Error already handled by mutation error handler
      throw error;
    }
  };

  // Get accounts for selected bank
  const getAccountsForBank = (bankId: string) => {
    return userAccounts.filter((acc) => acc.bankId === bankId);
  };

  return (
    <Modal show={isOpen} onClose={onClose} panelClassName='max-w-4xl'>
      <Modal.Header>
        <h2 className='text-xl font-semibold text-gray-900'>
          New Cash Snapshot
        </h2>
        <p className='text-sm text-gray-600 mt-1'>
          Record your current cash position across all bank accounts
        </p>
      </Modal.Header>

      <form onSubmit={handleSubmit}>
        <Modal.Body variant='spacious'>
          <div className='space-y-6'>
            {/* Snapshot Date */}
            <div>
              <Label htmlFor='snapshot-date'>Snapshot Date</Label>
              <input
                id='snapshot-date'
                type='date'
                value={snapshotDate}
                onChange={(e) => setSnapshotDate(e.target.value)}
                className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 dark:bg-gray-800 dark:text-white dark:border-gray-600'
                required
              />
            </div>

            {/* Account Entries */}
            <div>
              <div className='flex justify-between items-center mb-3'>
                <Label>Account Balances</Label>
                <Button
                  type='button'
                  variant='secondary'
                  onClick={handleAddEntry}
                >
                  <Plus className='mr-1 w-4 h-4' />
                  Add Account
                </Button>
              </div>

              {entries.length === 0 ? (
                <p className='text-gray-500 dark:text-gray-400 text-sm text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg'>
                  No accounts added yet. Click &quot;Add Account&quot; to start.
                </p>
              ) : (
                <div className='space-y-3'>
                  {entries.map((entry, index) => {
                    const selectedBankAccounts = getAccountsForBank(
                      entry.bankId,
                    );
                    const accountOptions = selectedBankAccounts.map((acc) => ({
                      value: acc.id,
                      label: acc.name,
                    }));

                    return (
                      <div
                        key={index}
                        className='p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-3'
                      >
                        {/* Bank Selector */}
                        <div>
                          <Label htmlFor={`bank-${index}`}>Bank</Label>
                          <select
                            id={`bank-${index}`}
                            value={entry.bankId}
                            onChange={(e) =>
                              handleEntryChange(index, 'bankId', e.target.value)
                            }
                            required
                            className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500'
                          >
                            <option value=''>-- Select Bank --</option>
                            {banks.map((bank) => (
                              <option key={bank.id} value={bank.id}>
                                {bank.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Account Selector (CreatableSelect) */}
                        <div>
                          <Label htmlFor={`account-${index}`}>Account</Label>
                          <CreatableSelect
                            inputId={`account-${index}`}
                            options={accountOptions}
                            value={
                              entry.accountId
                                ? {
                                    value: entry.accountId,
                                    label:
                                      selectedBankAccounts.find(
                                        (a) => a.id === entry.accountId,
                                      )?.name ||
                                      selectedBankAccounts[0]?.name ||
                                      'Select account...',
                                  }
                                : null
                            }
                            onChange={(option) => {
                              if (option) {
                                handleEntryChange(
                                  index,
                                  'accountId',
                                  option.value,
                                );
                              }
                            }}
                            onCreateOption={(inputValue) => {
                              if (!entry.bankId) {
                                toast.error('Please select a bank first');
                                return;
                              }

                              // Call async function without awaiting in callback
                              handleCreateAccount(entry.bankId, inputValue)
                                .then((newAccountId) => {
                                  // Update entry with new account
                                  handleEntryChange(
                                    index,
                                    'accountId',
                                    newAccountId,
                                  );
                                  toast.success(
                                    `Account "${inputValue}" created!`,
                                  );
                                })
                                .catch(() => {
                                  // Error already toasted in mutation handler
                                });
                            }}
                            isDisabled={!entry.bankId}
                            isClearable
                            placeholder='Select or type to create account...'
                            className='mt-1'
                            classNamePrefix='rs'
                            styles={{
                              control: (base) =>
                                ({
                                  ...base,
                                  borderColor: entry.bankId
                                    ? undefined
                                    : '#d1d5db',
                                  backgroundColor: entry.bankId
                                    ? 'white'
                                    : '#f3f4f6',
                                }) as typeof base,
                            }}
                            isLoading={createAccountMutation.isPending}
                          />
                          {!entry.bankId && (
                            <p className='mt-1 text-xs text-gray-500'>
                              Select a bank first to add accounts
                            </p>
                          )}
                        </div>

                        {/* Balance Input */}
                        <div>
                          <Label htmlFor={`balance-${index}`}>Balance</Label>
                          <NumericFormat
                            id={`balance-${index}`}
                            value={entry.balance}
                            onValueChange={(values) => {
                              handleEntryChange(
                                index,
                                'balance',
                                values.floatValue || 0,
                              );
                            }}
                            thousandSeparator=','
                            prefix='$'
                            decimalScale={2}
                            fixedDecimalScale
                            className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500'
                            placeholder='0.00'
                            required
                          />
                        </div>

                        {/* Remove Button */}
                        {entries.length > 1 && (
                          <div className='flex justify-end'>
                            <button
                              type='button'
                              onClick={() => handleRemoveEntry(index)}
                              className='text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded text-sm font-medium'
                              aria-label='Remove account entry'
                            >
                              Remove Account
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button type='button' variant='secondary' onClick={onClose}>
            Cancel
          </Button>
          <Button
            type='submit'
            variant='primary'
            disabled={createSnapshotMutation.isPending}
          >
            {createSnapshotMutation.isPending ? 'Saving...' : 'Save Snapshot'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
