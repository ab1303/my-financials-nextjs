'use client';

import { enableMapSet } from 'immer';

enableMapSet();

import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
} from '@tanstack/react-table';
import { Loader2, Trash2, TrendingUp, Plus, Pen, Save, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { produce, castDraft } from 'immer';

import { Card, Button } from '@/components';
import { Label, TextInput } from '@/components/ui';
import Table from '@/components/table';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import { trpc } from '@/server/trpc/client';

type BrokerageRow = {
  id: string;
  name: string;
};

const columnHelper = createColumnHelper<BrokerageRow>();

export default function BrokeragesForm() {
  const queryClient = useQueryClient();
  const [brokerageName, setBrokerageName] = useState('');
  const [editedRows, setEditedRows] = useState<Map<number, BrokerageRow>>(
    new Map(),
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const getBrokeragesQuery = trpc.brokerage.getAllBrokerages.useQuery();

  const saveMutation = trpc.brokerage.saveBrokerageDetails.useMutation({
    onSuccess() {
      void queryClient.refetchQueries({
        queryKey: [['brokerage', 'getAllBrokerages']],
      });
      toast.success('Brokerage institution added');
      setBrokerageName('');
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.brokerage.updateBrokerageDetails.useMutation({
    onSuccess() {
      void queryClient.refetchQueries({
        queryKey: [['brokerage', 'getAllBrokerages']],
      });
      toast.success('Brokerage institution updated');
      setEditedRows(new Map());
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.brokerage.removeBrokerageDetails.useMutation({
    onSuccess() {
      void queryClient.refetchQueries({
        queryKey: [['brokerage', 'getAllBrokerages']],
      });
      toast.success('Brokerage institution removed');
      setDeleteTarget(null);
      setShowDeleteConfirm(false);
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const handleAdd = () => {
    const trimmed = brokerageName.trim();
    if (!trimmed) return;
    saveMutation.mutate({ name: trimmed });
  };

  const columns: ColumnDef<BrokerageRow>[] = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Institution',
        cell: ({ getValue, row, table }) => {
          const editedRecord = (table.options.meta as any)?.editedRows.get(
            row.index,
          );
          const value = editedRecord ? editedRecord.name : getValue();

          if (editedRecord) {
            const brokerage = row.original;
            return (
              <TextInput
                autoFocus
                value={value}
                onChange={(e) => {
                  const updatedRecord = { ...editedRecord, name: e.target.value };
                  setEditedRows(
                    produce((draft) => {
                      draft.set(row.index, castDraft(updatedRecord));
                    }),
                  );
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (value.trim()) {
                      updateMutation.mutate({
                        brokerageId: brokerage.id,
                        name: value.trim(),
                      });
                    }
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setEditedRows(
                      produce((draft) => {
                        draft.delete(row.index);
                      }),
                    );
                  }
                }}
                className='max-w-xs'
              />
            );
          }

          return (
            <div className='flex items-center gap-2'>
              <TrendingUp
                className='h-4 w-4 flex-shrink-0 text-muted-foreground'
                aria-hidden='true'
              />
              {value}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        cell: ({ row, table }) => {
          const isEditing = (table.options.meta as any)?.editedRows.has(
            row.index,
          );
          const brokerage = row.original;

          if (isEditing) {
            return (
              <div className='flex justify-end gap-1'>
                <button
                  type='button'
                  onClick={() => {
                    setEditedRows(
                      produce((draft) => {
                        draft.delete(row.index);
                      }),
                    );
                  }}
                  aria-label='Cancel editing'
                  title='Cancel'
                  className='rounded p-1 text-muted-foreground hover:bg-muted'
                >
                  <Undo2 className='h-4 w-4' aria-hidden='true' />
                </button>
                <button
                  type='button'
                  onClick={async () => {
                    const edited = editedRows.get(row.index);
                    if (edited?.name.trim()) {
                      updateMutation.mutate({
                        brokerageId: brokerage.id,
                        name: edited.name.trim(),
                      });
                    }
                  }}
                  disabled={updateMutation.isPending}
                  aria-label='Save changes'
                  title='Save'
                  className='rounded p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-950 disabled:opacity-50'
                >
                  {updateMutation.isPending ? (
                    <Loader2 className='h-4 w-4 animate-spin' aria-hidden='true' />
                  ) : (
                    <Save className='h-4 w-4' aria-hidden='true' />
                  )}
                </button>
              </div>
            );
          }

          return (
            <div className='flex justify-end gap-1'>
              <button
                type='button'
                onClick={() => {
                  setEditedRows(
                    produce((draft) => {
                      draft.set(row.index, castDraft(brokerage));
                    }),
                  );
                }}
                aria-label='Edit brokerage'
                title='Edit'
                className='rounded p-1 text-muted-foreground hover:bg-muted'
              >
                <Pen className='h-4 w-4' aria-hidden='true' />
              </button>
              <button
                type='button'
                onClick={() => {
                  setDeleteTarget(brokerage.id);
                  setShowDeleteConfirm(true);
                }}
                aria-label={`Remove ${brokerage.name}`}
                title='Delete'
                className='rounded p-1 text-destructive hover:bg-destructive/10'
              >
                <Trash2 className='h-4 w-4' aria-hidden='true' />
              </button>
            </div>
          );
        },
      }),
    ],
    [editedRows, updateMutation.isPending],
  );

  const table = useReactTable({
    data: getBrokeragesQuery.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      editedRows,
      setEditedRows,
      validRows: {},
      updateRow: async (rowIndex: number) => {
        const edited = editedRows.get(rowIndex);
        if (edited?.name.trim()) {
          const original = (getBrokeragesQuery.data ?? [])[rowIndex];
          if (original) {
            updateMutation.mutate({
              brokerageId: original.id,
              name: edited.name.trim(),
            });
          }
        }
      },
      removeRow: async (rowIndex: number) => {
        const brokerage = (getBrokeragesQuery.data ?? [])[rowIndex];
        if (brokerage) {
          setDeleteTarget(brokerage.id);
          setShowDeleteConfirm(true);
        }
      },
      revertData: (rowIndex: number) => {
        setEditedRows(
          produce((draft) => {
            draft.delete(rowIndex);
          }),
        );
      },
    } as any,
  });

  return (
    <>
      <Card>
        <Card.Header>
          <div className='flex justify-between text-left'>
            <Card.Header.Title>Brokerage Institutions</Card.Header.Title>
          </div>
          <p className='mt-1 text-sm text-muted-foreground'>
            Global institutions shared across all users. Pre-populate common
            brokerages for easier account setup.
          </p>
        </Card.Header>

        <Card.Body>
          {/* Inline add */}
          <div className='mb-6 flex items-end gap-3 max-w-md'>
            <div className='flex-1'>
              <Label htmlFor='brokerageName' className='cursor-pointer'>
                Brokerage Name
              </Label>
              <TextInput
                id='brokerageName'
                placeholder='e.g. Fidelity, Charles Schwab'
                value={brokerageName}
                onChange={(e) => setBrokerageName(e.target.value)}
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
              disabled={!brokerageName.trim() || saveMutation.isPending}
              onClick={handleAdd}
            >
              <Plus className='mr-1 h-4 w-4' aria-hidden='true' />
              Add
            </Button>
          </div>

          {/* Institution list */}
          {getBrokeragesQuery.isLoading ? (
            <div className='flex items-center gap-2 py-6 text-sm text-muted-foreground'>
              <Loader2 className='h-4 w-4 animate-spin' />
              Loading institutions…
            </div>
          ) : (getBrokeragesQuery.data ?? []).length > 0 ? (
            <div className='overflow-hidden rounded-lg border border-border'>
              <table className='w-full text-sm'>
                <thead className='bg-muted'>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className='cursor-default select-none px-4 py-3 text-left font-medium text-foreground'
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className='divide-y divide-border'>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className='hover:bg-muted/50'>
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className='px-4 py-3 text-foreground'
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className='flex flex-col items-center rounded-lg border border-dashed border-border py-10 text-center'>
              <TrendingUp
                className='mb-2 h-6 w-6 text-muted-foreground/50'
                aria-hidden='true'
              />
              <p className='text-sm font-medium text-foreground'>
                No brokerage institutions yet
              </p>
              <p className='mt-1 text-xs text-muted-foreground'>
                Add your first brokerage above to get started
              </p>
            </div>
          )}
        </Card.Body>
      </Card>

      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate({ brokerageId: deleteTarget });
          }
        }}
        title='Delete Brokerage'
        message='Are you sure you want to delete this brokerage institution? This action cannot be undone.'
        confirmButtonText='Delete'
        cancelButtonText='Cancel'
        variant='danger'
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}
