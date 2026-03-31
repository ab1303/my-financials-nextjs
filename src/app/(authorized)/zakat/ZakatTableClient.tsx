'use client';
import { enableMapSet } from 'immer';

enableMapSet();

import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

import Table from '@/components/table';
import { tableCellStyles } from '@/styles/theme';
import { Button } from '@/components';
import { useZakatPaymentState } from './StateProvider';

import { getTableColumns } from './_table/columns';

import type { ServerActionType, ZakatPaymentType } from './_types';
import type {
  CreateZakatPaymentInput,
  UpdateZakatPaymentInput,
  DeleteZakatPaymentInput,
} from './_schema';
import type { OptionType } from '@/types';

type ZakatTableClientProps = {
  individualsOptions: OptionType[];
  businessesOptions: OptionType[];
  editRow: (input: UpdateZakatPaymentInput) => Promise<ServerActionType>;
  addRow: (
    input: CreateZakatPaymentInput,
  ) => Promise<ServerActionType<ZakatPaymentType>>;
  deleteRow: (input: DeleteZakatPaymentInput) => Promise<ServerActionType>;
  calendarYearId: string;
};

export default function ZakatTableClient({
  individualsOptions,
  businessesOptions,
  addRow,
  editRow,
  deleteRow,
  calendarYearId,
}: ZakatTableClientProps) {
  const [editedRows, setEditedRows] = useState<Map<number, ZakatPaymentType>>(
    new Map(),
  );
  const [validRows, setValidRows] = useState({});

  const {
    state: { data },
    dispatch,
  } = useZakatPaymentState();

  const handleAddPayment = async () => {
    if (!calendarYearId) {
      toast.error('Please select a Zakat year first');
      return;
    }

    // Create a temporary new row for inline editing
    const tempId = `temp-${Date.now()}`;
    const newRow: ZakatPaymentType = {
      id: tempId,
      datePaid: new Date(),
      amount: 0,
      beneficiaryType: 'INDIVIDUAL',
      beneficiaryId: '',
    };

    // Add the temporary row to the state
    dispatch({
      type: 'ZAKAT/Payments/ADD_PAYMENT',
      payload: {
        zakatPaymentId: tempId,
        payment: newRow,
      },
    });

    // Immediately put the row into edit mode
    setEditedRows(new Map([[data.length, newRow]]));

    toast.info('New payment row added. Fill in the details and save.');
  };

  const columns = useMemo(
    () => getTableColumns(individualsOptions, businessesOptions),
    [individualsOptions, businessesOptions],
  );

  const table = useReactTable<ZakatPaymentType>({
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
            type: 'ZAKAT/Payments/REMOVE_PAYMENT',
            payload: {
              zakatPaymentId: row.id,
            },
          });
          toast.info('New payment cancelled');
        }
        console.log('row reverted in client', rowIndex);
      },
      updateRow: async (rowIndex: number) => {
        const row = data[rowIndex];
        if (!row) return;

        const updatedRecord = editedRows.get(rowIndex);
        if (!updatedRecord) return;

        // Check if this is a temporary row (new payment)
        if (updatedRecord.id.startsWith('temp-')) {
          // Create new payment
          const createResult = await addRow({
            datePaid: updatedRecord.datePaid,
            amount: updatedRecord.amount,
            beneficiaryType: updatedRecord.beneficiaryType,
            beneficiaryId: updatedRecord.beneficiaryId || undefined,
            calendarYearId: calendarYearId,
          });

          if (createResult.success && createResult.data) {
            // Remove the temporary row
            dispatch({
              type: 'ZAKAT/Payments/REMOVE_PAYMENT',
              payload: {
                zakatPaymentId: updatedRecord.id,
              },
            });
            // Add the real row
            dispatch({
              type: 'ZAKAT/Payments/ADD_PAYMENT',
              payload: {
                zakatPaymentId: createResult.data.id,
                payment: createResult.data as ZakatPaymentType,
              },
            });
            toast.success('Payment created successfully');
          } else {
            toast.error(
              (createResult.error as string) || 'Failed to create payment',
            );
          }
        } else {
          // Update existing payment
          const editResult = await editRow({
            id: updatedRecord.id,
            datePaid: updatedRecord.datePaid,
            amount: updatedRecord.amount,
            beneficiaryType: updatedRecord.beneficiaryType,
            beneficiaryId: updatedRecord.beneficiaryId,
          });

          if (editResult.success) {
            dispatch({
              type: 'ZAKAT/Payments/EDIT_PAYMENT',
              payload: {
                payment: updatedRecord,
                zakatPaymentId: updatedRecord.id,
              },
            });
            toast.success('Payment updated successfully');
          } else {
            toast.error(
              (editResult.error as string) || 'Failed to update payment',
            );
          }
        }
      },
      removeRow: async (rowIndex: number) => {
        const record = data[rowIndex];
        if (!record) return;

        // Check if this is a temporary row
        if (record.id.startsWith('temp-')) {
          // Just remove from state, no server call needed
          dispatch({
            type: 'ZAKAT/Payments/REMOVE_PAYMENT',
            payload: {
              zakatPaymentId: record.id,
            },
          });
          toast.info('New payment cancelled');
          return;
        }

        // Handle real payment deletion
        const deleteResult = await deleteRow({ id: record.id });
        if (deleteResult.success) {
          dispatch({
            type: 'ZAKAT/Payments/REMOVE_PAYMENT',
            payload: {
              zakatPaymentId: record.id,
            },
          });
          toast.success('Payment deleted successfully');
        } else {
          toast.error(
            (deleteResult.error as string) || 'Failed to delete payment',
          );
        }
        console.log('row deleted in client', deleteResult);
      },
    },
  });

  return (
    <>
      <div className='mb-4 flex justify-between items-center'>
        <h3 className='text-sm font-medium text-gray-700'>Payment Records</h3>
        <button
          type='button'
          className={tableCellStyles.addButton}
          onClick={handleAddPayment}
          disabled={!calendarYearId}
          aria-label='Add new payment'
          title='Add Payment'
        >
          <Plus size={14} />
        </button>
      </div>

      <div className='overflow-x-auto'>
        <Table>
          <Table.THead>
            {table.getHeaderGroups().map((headerGroup) => (
              <Table.THead.TR key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <Table.THead.TH key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </Table.THead.TH>
                ))}
              </Table.THead.TR>
            ))}
          </Table.THead>
          <Table.TBody>
            {table.getRowModel().rows.length === 0 ? (
              <Table.TBody.TR>
                <td colSpan={5} className='text-center py-8 text-gray-500 px-6'>
                  {!calendarYearId
                    ? 'Please select a Zakat year to view payments'
                    : 'No payments recorded for this Zakat year'}
                </td>
              </Table.TBody.TR>
            ) : (
              table.getRowModel().rows.map((row) => {
                return (
                  <Table.TBody.TR key={row.id}>
                    {row.getVisibleCells().map((cell) => {
                      return (
                        <Table.TBody.TD
                          key={cell.id}
                          style={{ width: cell.column.getSize() }}
                          className='min-w-0' // Prevent content overflow
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </Table.TBody.TD>
                      );
                    })}
                  </Table.TBody.TR>
                );
              })
            )}
          </Table.TBody>
        </Table>
      </div>
    </>
  );
}
