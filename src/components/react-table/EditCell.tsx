import type { CellContext, RowData } from '@tanstack/react-table';
import type { Dispatch, MouseEvent, SetStateAction } from 'react';
import { castDraft, produce } from 'immer';

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    validRows: Record<string, TData>;
    editedRows: Map<string, TData>;
    updateRow: (rowIndex: number) => void;
    removeRow: (rowIndex: number) => void;
    revertData: (rowIndex: number) => void;
    setEditedRows: Dispatch<SetStateAction<Map<string, TData>>>;
  }
}

type EditCellProps<TData, TValue> = {
  table: CellContext<TData, TValue>['table'];
  row: CellContext<TData, TValue>['row'];
};

export const EditCell = <TData, TValue>({
  row,
  table,
}: EditCellProps<TData, TValue>) => {
  const meta = table.options.meta;
  const validRow = meta?.validRows[row.id];
  const disableSubmit = validRow
    ? Object.values(validRow)?.some((item) => !item)
    : false;

  const setEditedRows = (e: MouseEvent<HTMLButtonElement>) => {
    const elName = e.currentTarget.name;

    meta?.setEditedRows(
      produce((draft) => {
        draft.has(row.id)
          ? draft.delete(row.id)
          : draft.set(row.id, castDraft(row.original));
      })
    );

    switch (elName) {
      case 'edit':
        break;
      case 'cancel':
        meta?.revertData(row.index);
        break;
      case 'done':
        meta?.updateRow(row.index);
        break;
    }

    e.preventDefault();
    e.stopPropagation();
  };

  const removeRow = () => {
    meta?.removeRow(row.index);
  };

  return (
    <div className='flex justify-center items-center gap-1'>
      {meta?.editedRows.get(row.id) ? (
        <div className='flex gap-1'>
          <button
            className='rounded-full h-7 w-7 bg-gray-200 text-slate-400'
            onClick={setEditedRows}
            name='cancel'
          >
            ⚊
          </button>{' '}
          <button
            className='rounded-full h-7 w-7 bg-gray-200 text-green-400'
            onClick={setEditedRows}
            name='done'
            disabled={disableSubmit}
          >
            ✔
          </button>
        </div>
      ) : (
        <div className='flex gap-1'>
          <button
            className='rounded-full h-7 w-7 bg-gray-200 text-blue-400'
            onClick={setEditedRows}
            name='edit'
          >
            ✐
          </button>
          <button
            className='rounded-full h-7 w-7 bg-gray-200 text-red-400'
            onClick={removeRow}
            name='remove'
          >
            X
          </button>
        </div>
      )}
    </div>
  );
};
