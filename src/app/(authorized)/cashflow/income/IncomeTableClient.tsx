'use client';

import React from 'react';

import { enableMapSet } from 'immer';

enableMapSet();

import { useMemo, useState, useTransition } from 'react';
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { NumericFormat } from 'react-number-format';

import Table from '@/components/table';
import { Button } from '@/components/ui/button';
import { useIncomeEntryState } from './StateProvider';
import SourceBreakdownWidget from './_components/SourceBreakdownWidget';

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

type MonthGroup = {
  key: string;
  label: string;
  subtotal: number;
  entries: Array<{ entry: IncomeEntryType; originalIndex: number }>;
};

export function groupByMonth(entries: IncomeEntryType[]): MonthGroup[] {
  const map = new Map<string, MonthGroup>();
  entries.forEach((entry, originalIndex) => {
    const d = new Date(entry.dateEarned);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
    if (!map.has(key)) map.set(key, { key, label, subtotal: 0, entries: [] });
    const group = map.get(key)!;
    group.subtotal += entry.amount;
    group.entries.push({ entry, originalIndex });
  });
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}

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
    const tempId = `temp-${Date.now()}`;
    const newRow: IncomeEntryType = {
      id: tempId,
      dateEarned: new Date(),
      amount: 0,
      incomeSourceId: '',
      incomeSourceName: '',
      incomeLedgerId: '',
    };
    dispatch({ type: 'INCOME/Entries/ADD_ENTRY', payload: { incomeEntryId: tempId, entry: newRow } });
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
          dispatch({ type: 'INCOME/Entries/REMOVE_ENTRY', payload: { incomeEntryId: row.id } });
          toast.info('New income entry cancelled');
        }
      },
      updateRow: async (rowIndex: number) => {
        const row = data[rowIndex];
        if (!row) return;
        const updatedRecord = editedRows.get(rowIndex);
        if (!updatedRecord) return;
        if (updatedRecord.amount <= 0) { toast.error('Please enter a valid amount'); return; }
        if (!updatedRecord.incomeSourceId) { toast.error('Please select an income source'); return; }
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
              setEditedRows((prev) => { const m = new Map(prev); m.delete(rowIndex); return m; });
              toast.success('Income entry created successfully');
              router.refresh();
            } else {
              toast.error(createResult.error instanceof Error ? createResult.error.message : 'Failed to create income entry');
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
              dispatch({ type: 'INCOME/Entries/EDIT_ENTRY', payload: { incomeEntryId: updatedRecord.id, entry: updatedRecord } });
              setEditedRows((prev) => { const m = new Map(prev); m.delete(rowIndex); return m; });
              toast.success('Income entry updated successfully');
              router.refresh();
            } else {
              toast.error(updateResult.error instanceof Error ? updateResult.error.message : 'Failed to update income entry');
            }
          });
        }
      },
      removeRow: async (rowIndex: number) => {
        const row = data[rowIndex];
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
            toast.error(deleteResult.error instanceof Error ? deleteResult.error.message : 'Failed to delete income entry');
          }
        });
      },
    },
  });

  return (
    <div className='relative overflow-auto'>
      <div className='flex justify-end mb-3'>
        <Button variant='default' onClick={handleAddEntry} disabled={isPending} aria-label='Add new income entry'>
          <Plus className='w-4 h-4' />
          Add Entry
        </Button>
      </div>

      {data.length > 0 && <SourceBreakdownWidget entries={data} />}

      <Table>
        <Table.THead>
          {table.getHeaderGroups().map((headerGroup) => (
            <Table.THead.TR key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <Table.THead.TH key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </Table.THead.TH>
              ))}
            </Table.THead.TR>
          ))}
        </Table.THead>
        <Table.TBody>
          {groupByMonth(data).map((group) => (
            <React.Fragment key={group.key}>
              {/* Month group header row */}
              <Table.TBody.TR>
                <Table.TBody.TD colSpan={columns.length} className='bg-muted/30 py-1.5 px-3'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm font-semibold text-foreground'>
                      {group.label}
                    </span>
                    <NumericFormat
                      value={group.subtotal}
                      displayType='text'
                      thousandSeparator
                      prefix='$'
                      decimalScale={2}
                      fixedDecimalScale
                      className='text-sm font-semibold text-foreground tabular-nums'
                    />
                  </div>
                </Table.TBody.TD>
              </Table.TBody.TR>
              {/* Entry rows — use originalIndex to keep editedRows Map stable */}
              {group.entries.map(({ originalIndex }) => {
                const row = table.getRowModel().rows[originalIndex];
                if (!row) return null;
                return (
                  <Table.TBody.TR key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <Table.TBody.TD key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Table.TBody.TD>
                    ))}
                  </Table.TBody.TR>
                );
              })}
            </React.Fragment>
          ))}
        </Table.TBody>
      </Table>
    </div>
  );
}

