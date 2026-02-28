'use client';
import { enableMapSet } from 'immer';

enableMapSet();

import { useMemo, useState, useTransition } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import { toast } from 'react-toastify';
import { FaPlus } from 'react-icons/fa';
import { useRouter } from 'next/navigation';

import Table from '@/components/table';
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
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const validRows = {};

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
          // Validate required fields before creating
          if (!updatedRecord.beneficiaryId) {
            toast.error('Please select a beneficiary before saving');
            return;
          }
          if (!updatedRecord.taxCategory) {
            toast.error('Please select a tax category before saving');
            return;
          }
          if (updatedRecord.amount <= 0) {
            toast.error('Please enter a valid amount');
            return;
          }

          // Create new payment
          startTransition(async () => {
            const createResult = await addRow({
              datePaid: updatedRecord.datePaid,
              amount: updatedRecord.amount,
              beneficiaryType: updatedRecord.beneficiaryType,
              taxCategory: updatedRecord.taxCategory,
              beneficiaryId: updatedRecord.beneficiaryId,
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
              // Clear only this specific row's edit state on success
              setEditedRows((prev) => {
                const newMap = new Map(prev);
                newMap.delete(rowIndex);
                return newMap;
              });
              toast.success('Donation created successfully');
              // Refresh to get updated server data (including totals)
              router.refresh();
            } else {
              const errorMessage =
                createResult.error instanceof Error
                  ? createResult.error.message
                  : 'Failed to create donation';
              toast.error(errorMessage);
              // Keep row in edit mode by not clearing editedRows
            }
          });
        } else {
          // Validate required fields before updating
          if (!updatedRecord.beneficiaryId) {
            toast.error('Please select a beneficiary before saving');
            return;
          }
          if (!updatedRecord.taxCategory) {
            toast.error('Please select a tax category before saving');
            return;
          }
          if (updatedRecord.amount <= 0) {
            toast.error('Please enter a valid amount');
            return;
          }

          // Update existing payment
          startTransition(async () => {
            const updateResult = await editRow({
              id: updatedRecord.id,
              datePaid: updatedRecord.datePaid,
              amount: updatedRecord.amount,
              beneficiaryType: updatedRecord.beneficiaryType,
              taxCategory: updatedRecord.taxCategory,
              beneficiaryId: updatedRecord.beneficiaryId,
            });

            if (updateResult.success) {
              dispatch({
                type: 'DONATION/Payments/EDIT_PAYMENT',
                payload: {
                  donationPaymentId: updatedRecord.id,
                  payment: updatedRecord,
                },
              });
              // Clear only this specific row's edit state on success
              setEditedRows((prev) => {
                const newMap = new Map(prev);
                newMap.delete(rowIndex);
                return newMap;
              });
              toast.success('Donation updated successfully');
              // Refresh to get updated server data (including totals)
              router.refresh();
            } else {
              const errorMessage =
                updateResult.error instanceof Error
                  ? updateResult.error.message
                  : 'Failed to update donation';
              toast.error(errorMessage);
              // Keep row in edit mode by not clearing editedRows
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
            type: 'DONATION/Payments/REMOVE_PAYMENT',
            payload: {
              donationPaymentId: row.id,
            },
          });
          toast.info('New donation cancelled');
          return;
        }

        startTransition(async () => {
          const deleteResult = await deleteRow({ id: row.id });

          if (deleteResult.success) {
            dispatch({
              type: 'DONATION/Payments/REMOVE_PAYMENT',
              payload: {
                donationPaymentId: row.id,
              },
            });
            toast.success('Donation deleted successfully');
            // Refresh to get updated server data (including totals)
            router.refresh();
          } else {
            const errorMessage =
              deleteResult.error instanceof Error
                ? deleteResult.error.message
                : 'Failed to delete donation';
            toast.error(errorMessage);
          }
        });
      },
    },
  });

  return (
    <>
      <div className='mb-6 flex justify-between items-center'>
        <h3 className='text-lg font-medium text-gray-900'>
          Payment Records
          {isPending && (
            <span className='ml-2 text-sm text-gray-500'>(Updating...)</span>
          )}
        </h3>
        <button
          type='button'
          className='inline-flex items-center justify-center w-10 h-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed bg-teal-100 text-teal-600 hover:bg-teal-200 focus:ring-teal-500 transition-colors'
          onClick={handleAddPayment}
          disabled={!calendarYearId || isPending}
          aria-label='Add new donation'
          title='Add Donation'
        >
          <FaPlus size={16} />
        </button>
      </div>

      <div className='overflow-x-auto'>
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
            {table.getRowModel().rows.length === 0 ? (
              <Table.TBody.TR>
                <td
                  colSpan={6}
                  className='text-center py-12 text-gray-500 px-6 bg-gray-50'
                >
                  <div className='flex flex-col items-center'>
                    <div className='text-gray-400 mb-2'>
                      <FaPlus size={24} />
                    </div>
                    <p className='text-base font-medium text-gray-900 mb-1'>
                      {!calendarYearId
                        ? 'Select a fiscal year'
                        : 'No donations recorded'}
                    </p>
                    <p className='text-sm text-gray-500'>
                      {!calendarYearId
                        ? 'Please select a fiscal year to view donations'
                        : 'Click the + button above to add your first donation record'}
                    </p>
                  </div>
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
    </>
  );
}
