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

import Table from '@/components/table';
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
  editRow: (input: UpdateZakatPaymentInput) => Promise<ServerActionType>;
  addRow: (
    input: CreateZakatPaymentInput,
  ) => Promise<ServerActionType<ZakatPaymentType>>;
  deleteRow: (input: DeleteZakatPaymentInput) => Promise<ServerActionType>;
  calendarYearId: string;
};

export default function ZakatTableClient({
  individualsOptions,
  addRow,
  editRow,
  deleteRow,
  calendarYearId,
}: ZakatTableClientProps) {
  const [editedRows, setEditedRows] = useState<Map<number, ZakatPaymentType>>(
    new Map(),
  );
  const [validRows, setValidRows] = useState({});
  const [isAddingPayment, setIsAddingPayment] = useState(false);

  const {
    state: { data },
    dispatch,
  } = useZakatPaymentState();

  const handleAddPayment = async () => {
    if (!calendarYearId) {
      toast.error('Please select a Zakat year first');
      return;
    }

    setIsAddingPayment(true);

    try {
      // Create a new payment with default values
      const today = new Date();
      const newPaymentInput: CreateZakatPaymentInput = {
        datePaid: today,
        amount: 0,
        beneficiaryType: 'INDIVIDUAL',
        beneficiaryId: undefined,
        calendarYearId: calendarYearId,
      };

      const addResult = await addRow(newPaymentInput);

      if (addResult.success && addResult.data) {
        dispatch({
          type: 'ZAKAT/Payments/ADD_PAYMENT',
          payload: {
            zakatPaymentId: addResult.data.id,
            payment: addResult.data as ZakatPaymentType,
          },
        });
        toast.success('Payment added! Click edit to modify details.');
      } else {
        toast.error((addResult.error as string) || 'Failed to add payment');
      }
    } catch (error) {
      toast.error('Failed to add payment');
      console.error('Add payment error:', error);
    } finally {
      setIsAddingPayment(false);
    }
  };

  const columns = useMemo(
    () => getTableColumns(individualsOptions),
    [individualsOptions],
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
        // TODO
        // setData((old) =>
        //   old.map((row, index) =>
        //     index === rowIndex ? originalData[rowIndex] : row
        //   )
        // );
        console.log('row reverted in client', rowIndex);
      },
      updateRow: async (rowIndex: number) => {
        const row = data[rowIndex];
        if (!row) return;

        const updatedRecord = editedRows.get(rowIndex);
        if (!updatedRecord) return;

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
        }
        console.log('row updated in client', editResult);
      },
      removeRow: async (rowIndex: number) => {
        const record = data[rowIndex];
        if (!record) return;

        const deleteResult = await deleteRow({ id: record.id });
        if (deleteResult.success) {
          dispatch({
            type: 'ZAKAT/Payments/REMOVE_PAYMENT',
            payload: {
              zakatPaymentId: record.id,
            },
          });
        }
        console.log('row deleted in client', deleteResult);
      },
    },
  });

  return (
    <>
      <div className='mb-4 flex justify-between items-center'>
        <h3 className='text-sm font-medium text-gray-700'>Payment Records</h3>
        <Button
          variant='primary'
          onClick={handleAddPayment}
          isLoading={isAddingPayment}
          disabled={!calendarYearId}
        >
          Add Payment
        </Button>
      </div>

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
          {table.getRowModel().rows.map((row) => {
            return (
              <Table.TBody.TR key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  return (
                    <Table.TBody.TD
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
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
          })}
        </Table.TBody>
      </Table>
    </>
  );
}
