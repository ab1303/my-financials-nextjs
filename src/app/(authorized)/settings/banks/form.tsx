'use client';

import { useState } from 'react';
import { Loader2, Trash2, Building2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { Card, Button } from '@/components';
import { Label, TextInput } from '@/components/ui';
import { trpc } from '@/server/trpc/client';

export default function BanksForm() {
  const queryClient = useQueryClient();
  const [bankName, setBankName] = useState('');

  const getBanksQuery = trpc.bank.getAllBanks.useQuery();

  const saveMutation = trpc.bank.saveBankDetails.useMutation({
    onSuccess() {
      void queryClient.refetchQueries({ queryKey: [['bank', 'getAllBanks']] });
      toast.success('Bank institution added');
      setBankName('');
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.bank.removeBankDetails.useMutation({
    onSuccess() {
      void queryClient.refetchQueries({ queryKey: [['bank', 'getAllBanks']] });
      toast.success('Bank institution removed');
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const handleAdd = () => {
    const trimmed = bankName.trim();
    if (!trimmed) return;
    saveMutation.mutate({ name: trimmed });
  };

  const banks = getBanksQuery.data ?? [];

  return (
    <Card>
      <Card.Header>
        <div className='flex justify-between text-left'>
          <Card.Header.Title>Bank Institutions</Card.Header.Title>
        </div>
        <p className='mt-1 text-sm text-muted-foreground'>
          Global institutions shared across all users. Used when setting up bank accounts for CSV import.
        </p>
      </Card.Header>

      <Card.Body>
        {/* Inline add */}
        <div className='mb-6 flex items-end gap-3 max-w-md'>
          <div className='flex-1'>
            <Label htmlFor='bankName'>Bank Name</Label>
            <TextInput
              id='bankName'
              placeholder='e.g. Commonwealth Bank'
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
          </div>
          <Button
            variant='primary'
            type='button'
            isLoading={saveMutation.isPending}
            disabled={!bankName.trim() || saveMutation.isPending}
            onClick={handleAdd}
          >
            <Plus className='mr-1 h-4 w-4' aria-hidden='true' />
            Add
          </Button>
        </div>

        {/* Institution list */}
        {getBanksQuery.isLoading ? (
          <div className='flex items-center gap-2 py-6 text-sm text-muted-foreground'>
            <Loader2 className='h-4 w-4 animate-spin' />
            Loading institutions…
          </div>
        ) : banks.length > 0 ? (
          <div className='overflow-hidden rounded-lg border border-border'>
            <table className='w-full text-sm'>
              <thead className='bg-muted'>
                <tr>
                  <th className='cursor-default select-none px-4 py-3 text-left font-medium text-foreground'>
                    Institution
                  </th>
                  <th className='w-12 px-4 py-3' />
                </tr>
              </thead>
              <tbody className='divide-y divide-border'>
                {banks.map((bank) => (
                  <tr key={bank.id} className='hover:bg-muted/50'>
                    <td className='flex items-center gap-2 px-4 py-3 text-foreground'>
                      <Building2
                        className='h-4 w-4 flex-shrink-0 text-muted-foreground'
                        aria-hidden='true'
                      />
                      {bank.name}
                    </td>
                    <td className='px-4 py-3 text-right'>
                      {deleteMutation.isPending &&
                      deleteMutation.variables?.bankId === bank.id ? (
                        <Loader2 className='ml-auto h-4 w-4 animate-spin text-muted-foreground' />
                      ) : (
                        <button
                          type='button'
                          onClick={() =>
                            deleteMutation.mutate({ bankId: bank.id })
                          }
                          aria-label={`Remove ${bank.name}`}
                          className='rounded p-1 text-destructive hover:bg-destructive/10'
                        >
                          <Trash2 className='h-4 w-4' aria-hidden='true' />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className='flex flex-col items-center rounded-lg border border-dashed border-border py-10 text-center'>
            <Building2
              className='mb-2 h-6 w-6 text-muted-foreground/50'
              aria-hidden='true'
            />
            <p className='text-sm font-medium text-foreground'>
              No bank institutions yet
            </p>
            <p className='mt-1 text-xs text-muted-foreground'>
              Add your first bank above to get started
            </p>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
