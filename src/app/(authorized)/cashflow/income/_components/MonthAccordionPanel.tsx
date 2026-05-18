'use client';

import React from 'react';
import { useMemo, useState, useTransition } from 'react';
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Plus, ChevronRight, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { NumericFormat } from 'react-number-format';

import Table from '@/components/table';
import { Button } from '@/components/ui/button';
import { useIncomeEntryState } from '../StateProvider';
import { getTableColumns } from '../_table/columns';

import type { ServerActionType, IncomeEntryType } from '../_types';
import type {
  CreateIncomeEntryInput,
  UpdateIncomeEntryInput,
  DeleteIncomeEntryInput,
} from '../_schema';

type MonthAccordionPanelProps = {
  monthKey: string;
  label: string;
  subtotal: number;
  entryCount: number;
  entries: IncomeEntryType[];
  calendarYearId: string;
  addRow: (
    input: CreateIncomeEntryInput,
  ) => Promise<ServerActionType<IncomeEntryType>>;
  editRow: (input: UpdateIncomeEntryInput) => Promise<ServerActionType>;
  deleteRow: (input: DeleteIncomeEntryInput) => Promise<ServerActionType>;
  defaultOpen?: boolean;
};

export default function MonthAccordionPanel({
  monthKey,
  label,
  subtotal,
  entryCount,
  entries,
  calendarYearId,
  addRow,
  editRow,
  deleteRow,
  defaultOpen = false,
}: MonthAccordionPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [editedRows, setEditedRows] = useState<Map<number, IncomeEntryType>>(
    new Map(),
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const validRows = {};

  const { dispatch } = useIncomeEntryState();

  const handleAddEntry = async () => {
    if (!calendarYearId) {
      toast.error('Please select a fiscal year first');
      return;
    }
    const tempId = `temp-${Date.now()}`;
    const parts = monthKey.split('-');
    const year = parseInt(parts[0] || '2024', 10);
    const month = parseInt(parts[1] || '1', 10);
    const newRow: IncomeEntryType = {
      id: tempId,
      dateEarned: new Date(year, month - 1, 1),
      amount: 0,
      incomeSourceId: '',
      incomeSourceName: '',
      incomeLedgerId: '',
    };
    dispatch({ type: 'INCOME/Entries/ADD_ENTRY', payload: { incomeEntryId: tempId, entry: newRow } });
    setEditedRows(new Map([[entries.length, newRow]]));
    toast.info(`New income row added to ${label}. Fill in the details and save.`);
  };

  const columns = useMemo(() => getTableColumns(), []);

  const table = useReactTable<IncomeEntryType>({
    data: entries,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      editedRows,
      validRows,
      setEditedRows,
      revertData: (rowIndex: number) => {
        const row = entries[rowIndex];
        if (row && row.id.startsWith('temp-')) {
          dispatch({ type: 'INCOME/Entries/REMOVE_ENTRY', payload: { incomeEntryId: row.id } });
          toast.info('New income entry cancelled');
        }
      },
      updateRow: async (rowIndex: number) => {
        const row = entries[rowIndex];
        if (!row) return;
        const updatedRecord = editedRows.get(rowIndex);
        if (!updatedRecord) return;
        if (updatedRecord.amount <= 0) {
          toast.error('Please enter a valid amount');
          return;
        }
        if (!updatedRecord.incomeSourceId) {
          toast.error('Please select an income source');
          return;
        }
        if (updatedRecord.id.startsWith('temp-')) {
          startTransition(async () => {
            const createResult = await addRow({
              dateEarned: updatedRecord.dateEarned,
              amount: updatedRecord.amount,
              incomeSourceId: updatedRecord.incomeSourceId,
              calendarYearId: calendarYearId,
            });
            if (createResult.success && createResult.data) {
              dispatch({ type: 'INCOME/Entries/REMOVE_ENTRY', payload: { incomeEntryId: updatedRecord.id } });
              dispatch({ type: 'INCOME/Entries/ADD_ENTRY', payload: { incomeEntryId: createResult.data.id, entry: createResult.data as IncomeEntryType } });
              setEditedRows((prev) => {
                const m = new Map(prev);
                m.delete(rowIndex);
                return m;
              });
              toast.success('Income entry created successfully');
              router.refresh();
            } else {
              toast.error(
                createResult.error instanceof Error
                  ? createResult.error.message
                  : 'Failed to create income entry',
              );
            }
          });
        } else {
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
                payload: { incomeEntryId: updatedRecord.id, entry: updatedRecord },
              });
              setEditedRows((prev) => {
                const m = new Map(prev);
                m.delete(rowIndex);
                return m;
              });
              toast.success('Income entry updated successfully');
              router.refresh();
            } else {
              toast.error(
                updateResult.error instanceof Error
                  ? updateResult.error.message
                  : 'Failed to update income entry',
              );
            }
          });
        }
      },
      removeRow: async (rowIndex: number) => {
        const row = entries[rowIndex];
        if (!row) return;
        if (row.id.startsWith('temp-')) {
          dispatch({ type: 'INCOME/Entries/REMOVE_ENTRY', payload: { incomeEntryId: row.id } });
          toast.info('Temporary entry removed');
          return;
        }
        const confirmed = confirm('Are you sure you want to delete this income entry?');
        if (!confirmed) return;
        startTransition(async () => {
          const deleteResult = await deleteRow({ id: row.id });
          if (deleteResult.success) {
            dispatch({ type: 'INCOME/Entries/REMOVE_ENTRY', payload: { incomeEntryId: row.id } });
            toast.success('Income entry deleted successfully');
            router.refresh();
          } else {
            toast.error(
              deleteResult.error instanceof Error
                ? deleteResult.error.message
                : 'Failed to delete income entry',
            );
          }
        });
      },
    },
  });

  const panelId = `panel-${monthKey}`;

  return (
    <div className='border border-border rounded-md overflow-hidden bg-card dark:bg-card'>
      {/* Collapsed/Expanded Toggle Header */}
      <button
        type='button'
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className='w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/40 dark:bg-card dark:hover:bg-muted/40 transition-colors select-none cursor-pointer'
      >
        <div className='flex items-center gap-2'>
          {isOpen ? (
            <ChevronDown className='w-5 h-5 text-muted-foreground flex-shrink-0' />
          ) : (
            <ChevronRight className='w-5 h-5 text-muted-foreground flex-shrink-0' />
          )}
          <span className='text-sm font-semibold text-foreground dark:text-foreground'>
            {label}
          </span>
          <span className='ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-primary rounded-full'>
            {entryCount}
          </span>
        </div>
        <NumericFormat
          value={subtotal}
          displayType='text'
          thousandSeparator
          prefix='$'
          decimalScale={2}
          fixedDecimalScale
          className='text-base font-bold text-primary dark:text-primary tabular-nums'
        />
      </button>

      {/* Expanded Content */}
      {isOpen && (
        <div id={panelId} className='px-4 pb-4 pt-2 bg-card/50 dark:bg-card/50 border-t border-border'>
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
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </Table.TBody.TD>
                  ))}
                </Table.TBody.TR>
              ))}
            </Table.TBody>
          </Table>

          {/* Add Entry Button for this Month */}
          <div className='flex justify-end mt-3'>
            <Button
              variant='outline'
              size='sm'
              onClick={handleAddEntry}
              disabled={isPending}
              aria-label={`Add new income entry to ${label}`}
            >
              <Plus className='w-3 h-3' />
              Add Entry to {label}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
