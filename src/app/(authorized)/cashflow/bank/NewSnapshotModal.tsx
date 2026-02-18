'use client';

import { useState, useEffect } from 'react';
import { FiPlus } from 'react-icons/fi';
import { NumericFormat } from 'react-number-format';
import { toast } from 'react-toastify';

import { trpc } from '@/server/trpc/client';
import { Modal } from '@/components/ui/Modal';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components';

type NewSnapshotModalProps = {
  isOpen: boolean;
  onClose: () => void;
  mostRecentSnapshot: any;
  onSuccess: () => void;
};

export default function NewSnapshotModal({
  isOpen,
  onClose,
  mostRecentSnapshot,
  onSuccess,
}: NewSnapshotModalProps) {
  const [snapshotDate, setSnapshotDate] = useState<string>(() => {
    const today = new Date().toISOString().split('T')[0];
    return today || new Date().toISOString().substring(0, 10);
  });
  const [entries, setEntries] = useState<
    Array<{ accountId: string; balance: number }>
  >([]);

  // Fetch banks (type=BANK)
  const { data: banks } = trpc.business.getBusinessesByType.useQuery({
    type: 'BANK',
  });

  // Fetch all user's bank accounts
  const { data: userAccounts } = trpc.bankAsset.getBankAccounts.useQuery({});

  // Create snapshot mutation
  const createSnapshotMutation = trpc.bankAsset.createSnapshot.useMutation({
    onSuccess: () => {
      toast.success('Snapshot created successfully!');
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create snapshot');
    },
  });

  // Pre-fill form with most recent snapshot data
  useEffect(() => {
    if (mostRecentSnapshot?.entries && entries.length === 0) {
      const snapshotEntries = mostRecentSnapshot.entries.map((entry: any) => ({
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

    createSnapshotMutation.mutate({
      snapshotDate: new Date(snapshotDate),
      entries,
    });
  };

  const handleAddEntry = () => {
    setEntries([...entries, { accountId: '', balance: 0 }]);
  };

  const handleRemoveEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const handleEntryChange = (
    index: number,
    field: 'accountId' | 'balance',
    value: string | number,
  ) => {
    const newEntries = [...entries];
    if (field === 'accountId') {
      newEntries[index]!.accountId = value as string;
    } else {
      newEntries[index]!.balance = value as number;
    }
    setEntries(newEntries);
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
                className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500'
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
                  <FiPlus className='mr-1' />
                  Add Account
                </Button>
              </div>

              {entries.length === 0 ? (
                <p className='text-gray-500 text-sm text-center py-8 border-2 border-dashed border-gray-300 rounded-lg'>
                  No accounts added yet. Click &quot;Add Account&quot; to start.
                </p>
              ) : (
                <div className='space-y-3'>
                  {entries.map((entry, index) => (
                    <div
                      key={index}
                      className='flex gap-3 items-start p-4 bg-gray-50 rounded-lg'
                    >
                      <div className='flex-1'>
                        <Label htmlFor={`account-${index}`}>Account</Label>
                        <select
                          id={`account-${index}`}
                          value={entry.accountId}
                          onChange={(e) =>
                            handleEntryChange(
                              index,
                              'accountId',
                              e.target.value,
                            )
                          }
                          className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500'
                          required
                        >
                          <option value=''>Select account...</option>
                          {userAccounts?.map((account: any) => (
                            <option key={account.id} value={account.id}>
                              {account.bank.name} - {account.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className='w-48'>
                        <Label htmlFor={`balance-${index}`}>Balance</Label>
                        <NumericFormat
                          id={`balance-${index}`}
                          value={entry.balance}
                          onValueChange={(values) =>
                            handleEntryChange(
                              index,
                              'balance',
                              values.floatValue || 0,
                            )
                          }
                          thousandSeparator=','
                          prefix='$'
                          decimalScale={2}
                          fixedDecimalScale
                          className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500'
                          required
                        />
                      </div>

                      <button
                        type='button'
                        onClick={() => handleRemoveEntry(index)}
                        className='mt-7 p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded'
                        aria-label='Remove account entry'
                      >
                        <FiPlus className='rotate-45 w-5 h-5' />
                      </button>
                    </div>
                  ))}
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
