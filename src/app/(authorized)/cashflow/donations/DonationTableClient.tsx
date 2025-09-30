'use client';
import { enableMapSet } from 'immer';

enableMapSet();

import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import { toast } from 'react-toastify';
import { FaPlus } from 'react-icons/fa';

import Table from '@/components/table';
import { tableCellStyles } from '@/styles/theme';
import { Button } from '@/components';
import { useDonationPaymentState } from './StateProvider';

import { getTableColumns } from './_table/columns';

import type { ServerActionType, DonationPaymentType } from './_types';
import type {
  CreateDonationPaymentInput,
  UpdateDonationPaymentInput,
  DeleteDonationPaymentInput,
} from './_schema';
import type { OptionType } from '@/types';

type DonationTableClientProps = {
  individualsOptions: OptionType[];
  businessesOptions: OptionType[];
  editRow: (input: UpdateDonationPaymentInput) => Promise<ServerActionType>;
  addRow: (
    input: CreateDonationPaymentInput,
  ) => Promise<ServerActionType<DonationPaymentType>>;
  deleteRow: (input: DeleteDonationPaymentInput) => Promise<ServerActionType>;
  calendarYearId: string;
};

export default function DonationTableClient({
  individualsOptions,
  businessesOptions,
  addRow,
  editRow,
  deleteRow,
  calendarYearId,
}: DonationTableClientProps) {
  const [editedRows, setEditedRows] = useState<
    Map<number, DonationPaymentType>
  >(new Map());
  const [validRows, setValidRows] = useState({});

  const {
    state: { data },
    dispatch,
  } = useDonationPaymentState();

  const handleAddPayment = async () => {
    if (!calendarYearId) {
      toast.error('Please select a fiscal year first');
      return;
    }

    // Create a temporary new row for inline editing
    const tempId = `temp-${Date.now()}`;
    const newRow: DonationPaymentType = {
      id: tempId,
      datePaid: new Date(),
      amount: 0,
      beneficiaryType: 'INDIVIDUAL',
      beneficiaryId: '',
      taxCategory: '',
    };

    // Add the temporary row to the state
    dispatch({
      type: 'DONATION/Payments/ADD_PAYMENT',
      payload: {
        donationPaymentId: tempId,
        payment: newRow,
      },
    });

    // Immediately put the row into edit mode
    setEditedRows(new Map([[data.length, newRow]]));

    toast.info('New donation row added. Fill in the details and save.');
  };

  const columns = useMemo(
    () => getTableColumns(individualsOptions, businessesOptions),
    [individualsOptions, businessesOptions],
  );

  const table = useReactTable<DonationPaymentType>({
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
            type: 'DONATION/Payments/REMOVE_PAYMENT',
            payload: {
              donationPaymentId: row.id,
            },
          });
          toast.info('New donation cancelled');
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
            taxCategory: updatedRecord.taxCategory,
            beneficiaryId: updatedRecord.beneficiaryId || undefined,
            calendarYearId: calendarYearId,
          });

          if (createResult.success && createResult.data) {
            // Remove the temporary row
            dispatch({
              type: 'DONATION/Payments/REMOVE_PAYMENT',
              payload: {
                donationPaymentId: updatedRecord.id,
              },
            });
            // Add the real row
            dispatch({
              type: 'DONATION/Payments/ADD_PAYMENT',
              payload: {
                donationPaymentId: createResult.data.id,
                payment: createResult.data as DonationPaymentType,
              },
            });
            toast.success('Donation created successfully');
          } else {
            const errorMessage =
              createResult.error instanceof Error
                ? createResult.error.message
                : 'Failed to create donation';
            toast.error(errorMessage);
          }
        } else {
          // Update existing payment
          const updateResult = await editRow({
            id: updatedRecord.id,
            datePaid: updatedRecord.datePaid,
            amount: updatedRecord.amount,
            beneficiaryType: updatedRecord.beneficiaryType,
            taxCategory: updatedRecord.taxCategory,
            beneficiaryId: updatedRecord.beneficiaryId || undefined,
          });

          if (updateResult.success) {
            dispatch({
              type: 'DONATION/Payments/EDIT_PAYMENT',
              payload: {
                donationPaymentId: updatedRecord.id,
                payment: updatedRecord,
              },
            });
            toast.success('Donation updated successfully');
          } else {
            const errorMessage =
              updateResult.error instanceof Error
                ? updateResult.error.message
                : 'Failed to update donation';
            toast.error(errorMessage);
          }
        }
      },
      removeRow: async (rowIndex: number) => {
        const row = data[rowIndex];
        if (!row) return;

        if (row.id.startsWith('temp-')) {
          // Just remove from state if it's a temporary row
          dispatch({
            type: 'DONATION/Payments/REMOVE_PAYMENT',
            payload: {
              donationPaymentId: row.id,
            },
          });
          toast.info('New donation cancelled');
          return;
        }

        const deleteResult = await deleteRow({ id: row.id });

        if (deleteResult.success) {
          dispatch({
            type: 'DONATION/Payments/REMOVE_PAYMENT',
            payload: {
              donationPaymentId: row.id,
            },
          });
          toast.success('Donation deleted successfully');
        } else {
          const errorMessage =
            deleteResult.error instanceof Error
              ? deleteResult.error.message
              : 'Failed to delete donation';
          toast.error(errorMessage);
        }
      },
    },
  });

  return (
    <div className='space-y-4'>
      <div className='flex justify-between items-center'>
        <h3 className='text-lg font-medium text-gray-900'>Donation Payments</h3>
        <Button
          type='button'
          onClick={handleAddPayment}
          disabled={!calendarYearId}
          className='inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
        >
          <FaPlus className='-ml-0.5 mr-2 h-4 w-4' aria-hidden='true' />
          Add Donation
        </Button>
      </div>

      <div className='overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg'>
        <Table className='min-w-full divide-y divide-gray-300'>
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
            {table.getRowModel().rows.length === 0 ? (
              <Table.TBody.TR>
                <td colSpan={6} className='text-center py-8 text-gray-500 px-6'>
                  {!calendarYearId
                    ? 'Please select a fiscal year to view donations'
                    : 'No donations recorded for this fiscal year'}
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
                          className='min-w-0'
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
    </div>
  );
}
