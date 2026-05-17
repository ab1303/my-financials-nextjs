'use client';
import { enableMapSet } from 'immer';

enableMapSet();

import { useMemo, useState, useTransition } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

import Table from '@/components/table';
import { Button } from '@/components/ui/button';
import { useIncomeEntryState } from './StateProvider';

import { getTableColumns } from './_table/columns';

import type { ServerActionType, IncomeEntryType } from './_types';
import type {
  CreateIncomeEntryInput,
  UpdateIncomeEntryInput,
  DeleteIncomeEntryInput,
} from './_schema';

type IncomeTableClientProps = {
  editRow: (input: UpdateIncomeEntryInput) => Promise<ServerActionType>;
  addRow: (
    input: CreateIncomeEntryInput,
  ) => Promise<ServerActionType<IncomeEntryType>>;
  deleteRow: (input: DeleteIncomeEntryInput) => Promise<ServerActionType>;
  calendarYearId: string;
};

export default function IncomeTableClient({
  addRow,
  editRow,
  deleteRow,
  calendarYearId,
}: IncomeTableClientProps) {
  const [editedRows, setEditedRows] = useState<Map<number, IncomeEntryType>>(
    new Map(),
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const validRows = {};

  const {
    state: { data },
    dispatch,
  } = useIncomeEntryState();

  const handleAddEntry = async () => {
    if (!calendarYearId) {
      toast.error('Please select a fiscal year first');
      return;
    }

    // Create a temporary new row for inline editing
    const tempId = `temp-${Date.now()}`;
    const newRow: IncomeEntryType = {
      id: tempId,
      dateEarned: new Date(),
      amount: 0,
      incomeSourceId: '',
      incomeSourceName: '',
      incomeLedgerId: '',
    };

    // Add the temporary row to the state
    dispatch({
      type: 'INCOME/Entries/ADD_ENTRY',
      payload: {
        incomeEntryId: tempId,
        entry: newRow,
      },
    });

    // Immediately put the row into edit mode
    setEditedRows(new Map([[data.length, newRow]]));

    toast.info('New income row added. Fill in the details and save.');
  };

  const columns = useMemo(() => getTableColumns(), []);

  const table = useReactTable<IncomeEntryType>({
    data: data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      editedRows,
      validRows,
      setEditedRows,
      revertData: (rowIndex: number) => {
        const row = data[rowIndex];
        if (row && row.id.startsWith('temp-')) {
          // Remove temporary row if user cancels editing
          dispatch({
            type: 'INCOME/Entries/REMOVE_ENTRY',
            payload: {
              incomeEntryId: row.id,
            },
          });
          toast.info('New income entry cancelled');
        }
      },
      updateRow: async (rowIndex: number) => {
        const row = data[rowIndex];
        if (!row) return;

        const updatedRecord = editedRows.get(rowIndex);
        if (!updatedRecord) return;

        // Validate required fields
        if (updatedRecord.amount <= 0) {
          toast.error('Please enter a valid amount');
          return;
        }

        if (!updatedRecord.incomeSourceId) {
          toast.error('Please select an income source');
          return;
        }

        // Check if this is a temporary row (new entry)
        if (updatedRecord.id.startsWith('temp-')) {
          // Create new entry
          startTransition(async () => {
            const createResult = await addRow({
              dateEarned: updatedRecord.dateEarned,
              amount: updatedRecord.amount,
              incomeSourceId: updatedRecord.incomeSourceId,
              calendarYearId: calendarYearId,
            });

            if (createResult.success && createResult.data) {
              // Remove the temporary row
              dispatch({
                type: 'INCOME/Entries/REMOVE_ENTRY',
                payload: {
                  incomeEntryId: updatedRecord.id,
                },
              });
              // Add the real row
              dispatch({
                type: 'INCOME/Entries/ADD_ENTRY',
                payload: {
                  incomeEntryId: createResult.data.id,
                  entry: createResult.data as IncomeEntryType,
                },
              });
              // Clear edit state
              setEditedRows((prev) => {
                const newMap = new Map(prev);
                newMap.delete(rowIndex);
                return newMap;
              });
              toast.success('Income entry created successfully');
              router.refresh();
            } else {
              const errorMessage =
                createResult.error instanceof Error
                  ? createResult.error.message
                  : 'Failed to create income entry';
              toast.error(errorMessage);
            }
          });
        } else {
          // Update existing entry
          startTransition(async () => {
            const updateResult = await editRow({
              id: updatedRecord.id,
              dateEarned: updatedRecord.dateEarned,
              amount: updatedRecord.amount,
              incomeSourceId: updatedRecord.incomeSourceId,
            });

            if (updateResult.success) {
              dispatch({
                type: 'INCOME/Entries/EDIT_ENTRY',
                payload: {
                  incomeEntryId: updatedRecord.id,
                  entry: updatedRecord,
                },
              });
              // Clear edit state
              setEditedRows((prev) => {
                const newMap = new Map(prev);
                newMap.delete(rowIndex);
                return newMap;
              });
              toast.success('Income entry updated successfully');
              router.refresh();
            } else {
              const errorMessage =
                updateResult.error instanceof Error
                  ? updateResult.error.message
                  : 'Failed to update income entry';
              toast.error(errorMessage);
            }
          });
        }
      },
      removeRow: async (rowIndex: number) => {
        const row = data[rowIndex];
        if (!row) return;

        if (row.id.startsWith('temp-')) {
          // Just remove from state if it's a temporary row
          dispatch({
            type: 'INCOME/Entries/REMOVE_ENTRY',
            payload: {
              incomeEntryId: row.id,
            },
          });
          toast.info('Temporary entry removed');
          return;
        }

        // Confirm deletion for existing entries
        const confirmed = confirm(
          'Are you sure you want to delete this income entry?',
        );
        if (!confirmed) return;

        startTransition(async () => {
          const deleteResult = await deleteRow({ id: row.id });

          if (deleteResult.success) {
            dispatch({
              type: 'INCOME/Entries/REMOVE_ENTRY',
              payload: {
                incomeEntryId: row.id,
              },
            });
            toast.success('Income entry deleted successfully');
            router.refresh();
          } else {
            const errorMessage =
              deleteResult.error instanceof Error
                ? deleteResult.error.message
                : 'Failed to delete income entry';
            toast.error(errorMessage);
          }
        });
      },
    },
  });

  return (
    <div className='relative overflow-auto'>
      <div className='flex justify-end mb-3'>
        <Button
          variant='default'
          onClick={handleAddEntry}
          disabled={isPending}
          aria-label='Add new income entry'
        >
          <Plus className='w-4 h-4' />
          Add Entry
        </Button>
      </div>

      <Table>
        <Table.THead>
          {table.getHeaderGroups().map((headerGroup) => (
            <Table.THead.TR key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <Table.THead.TH key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </Table.THead.TH>
              ))}
            </Table.THead.TR>
          ))}
        </Table.THead>
        <Table.TBody>
          {table.getRowModel().rows.map((row) => (
            <Table.TBody.TR key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <Table.TBody.TD key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </Table.TBody.TD>
              ))}
            </Table.TBody.TR>
          ))}
        </Table.TBody>
      </Table>
    </div>
  );
}
