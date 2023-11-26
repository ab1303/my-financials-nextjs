import type { CellContext, RowData } from '@tanstack/react-table';
import type { Dispatch, MouseEvent, SetStateAction } from 'react';

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    validRows: Record<string, unknown>;
    editedRows: Record<string, unknown>;
    updateRow: (rowIndex: number) => void;
    removeRow: (rowIndex: number) => void;
    revertData: (rowIndex: number) => void;
    setEditedRows: Dispatch<SetStateAction<Record<string, unknown>>>;
  }
}

type EditCellProps<TData, TValue> = {
  row: CellContext<TData, TValue>['row'];
  table: CellContext<TData, TValue>['table'];
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
    meta?.setEditedRows((old: Record<string, unknown>) => ({
      ...old,
      [row.id]: !old[row.id],
    }));
    if (elName !== 'edit') {
      e.currentTarget.name === 'cancel'
        ? meta?.revertData(row.index)
        : meta?.updateRow(row.index);
    }
  };

  const removeRow = () => {
    meta?.removeRow(row.index);
  };

  return (
    <div className='edit-cell-container'>
      {meta?.editedRows[row.id] ? (
        <div className='edit-cell-action'>
          <button onClick={setEditedRows} name='cancel'>
            ⚊
          </button>{' '}
          <button onClick={setEditedRows} name='done' disabled={disableSubmit}>
            ✔
          </button>
        </div>
      ) : (
        <div className='edit-cell-action'>
          <button onClick={setEditedRows} name='edit'>
            ✐
          </button>
          <button onClick={removeRow} name='remove'>
            X
          </button>
        </div>
      )}
      <input
        type='checkbox'
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
      />
    </div>
  );
};
