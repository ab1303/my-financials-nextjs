'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card } from '@/components';
import { Label, TextInput } from '@/components/ui';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import {
  createBankAccountSchema,
  type CreateBankAccountInput,
} from '@/server/schema/bank-account.schema';
import { trpc } from '@/server/trpc/client';

export default function BankAccountsSection() {
  const utils = trpc.useUtils();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: accounts = [], isLoading } = trpc.bankAccount.list.useQuery();
  const { data: banks = [] } = trpc.bank.getAllBanks.useQuery();

  const { register, handleSubmit, reset, formState } =
    useForm<CreateBankAccountInput>({
      resolver: zodResolver(createBankAccountSchema),
      defaultValues: { name: '', institutionId: '' },
    });

  const createMutation = trpc.bankAccount.create.useMutation({
    onSuccess: () => {
      toast.success('Bank account added');
      reset();
      void utils.bankAccount.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.bankAccount.delete.useMutation({
    onSuccess: () => {
      toast.success('Bank account removed');
      setDeleteConfirmId(null);
      void utils.bankAccount.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteTarget = accounts.find((a) => a.id === deleteConfirmId);
  const hasBanks = banks.length > 0;

  const onSubmit = (data: CreateBankAccountInput) => {
    createMutation.mutate(data);
  };

  return (
    <>
      <Card>
        <Card.Header>
          <Card.Header.Title>Your Bank Accounts</Card.Header.Title>
          <p className='text-sm text-muted-foreground mt-1'>
            Add the individual accounts you hold at each bank. These are used
            when importing CSV statements.
          </p>
        </Card.Header>

        <Card.Body>
          {!isLoading && accounts.length > 0 && (
            <div className='overflow-x-auto rounded-lg border border-border mb-6'>
              <table className='w-full text-left text-sm'>
                <thead className='bg-muted'>
                  <tr>
                    {['Bank', 'Account Name', 'Transactions', ''].map((h) => (
                      <th
                        key={h}
                        className='cursor-default select-none px-4 py-3 font-medium text-foreground'
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className='divide-y divide-border'>
                  {accounts.map((acc) => (
                    <tr key={acc.id} className='hover:bg-muted/50'>
                      <td className='px-4 py-3 text-muted-foreground'>
                        {acc.institution.name}
                      </td>
                      <td className='px-4 py-3 text-foreground font-medium'>
                        {acc.name}
                      </td>
                      <td className='px-4 py-3 text-muted-foreground'>
                        {acc._count.transactions}
                      </td>
                      <td className='px-4 py-3 text-right'>
                        <button
                          type='button'
                          onClick={() => setDeleteConfirmId(acc.id)}
                          aria-label={`Delete ${acc.name}`}
                          className='text-destructive hover:bg-destructive/10 rounded p-1'
                        >
                          <Trash2 className='h-4 w-4' />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!hasBanks ? (
            <p className='text-sm text-muted-foreground'>
              Add a bank institution above before creating a bank account.
            </p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className='space-y-4 max-w-md'>
              <div>
                <Label htmlFor='institutionId'>Bank</Label>
                <select
                  id='institutionId'
                  {...register('institutionId')}
                  className='mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                >
                  <option value=''>Select a bank</option>
                  {banks.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {bank.name}
                    </option>
                  ))}
                </select>
                {formState.errors.institutionId && (
                  <p className='mt-1 text-xs text-destructive'>
                    {formState.errors.institutionId.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor='accountName'>Account Name</Label>
                <TextInput
                  id='accountName'
                  placeholder='e.g. Everyday Savings'
                  error={!!formState.errors.name}
                  {...register('name')}
                />
                {formState.errors.name && (
                  <p className='mt-1 text-xs text-destructive'>
                    {formState.errors.name.message}
                  </p>
                )}
              </div>

              <Button
                type='submit'
                variant='primary'
                isLoading={createMutation.isPending}
              >
                Add Account
              </Button>
            </form>
          )}
        </Card.Body>
      </Card>

      <ConfirmationDialog
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => {
          if (deleteConfirmId) {
            deleteMutation.mutate({ id: deleteConfirmId });
          }
        }}
        title='Remove Bank Account?'
        message={
          deleteTarget && deleteTarget._count.transactions > 0
            ? `This account has ${deleteTarget._count.transactions} transaction(s) linked to it. Removing it will not delete those transactions, but they will no longer be associated with a bank account.`
            : `Remove "${deleteTarget?.name ?? ''}" from ${deleteTarget?.institution.name ?? ''}?`
        }
        confirmButtonText='Remove'
        variant='warning'
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}
