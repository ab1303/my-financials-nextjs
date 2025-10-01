import type { CellContext, RowData } from '@tanstack/react-table';
import type { Dispatch, MouseEvent, SetStateAction } from 'react';
import { castDraft, produce } from 'immer';
import { FaPen, FaTrash, FaSave, FaUndo } from 'react-icons/fa';
import { useState } from 'react';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import { tableCellStyles } from '@/styles/theme';

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    validRows: Record<string, TData>;
    editedRows: Map<number, TData>;
    updateRow: (rowIndex: number) => void;
    removeRow: (rowIndex: number) => void;
    revertData: (rowIndex: number) => void;
    setEditedRows: Dispatch<SetStateAction<Map<number, TData>>>;
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const meta = table.options.meta;
  const validRow = meta?.validRows[row.id];
  const disableSubmit = validRow
    ? Object.values(validRow)?.some((item) => !item)
    : false;

  const setEditedRows = (e: MouseEvent<HTMLButtonElement>) => {
    const elName = e.currentTarget.name;

    meta?.setEditedRows(
      produce((draft) => {
        if (elName === 'edit') {
          // Add to edit mode
          if (!draft.has(row.index)) {
            draft.set(row.index, castDraft(row.original));
          }
        } else if (elName === 'cancel') {
          // Remove from edit mode on cancel
          if (draft.has(row.index)) {
            draft.delete(row.index);
          }
        }
        // For 'done', don't clear edit state here - let updateRow handle it on success
      }),
    );

    switch (elName) {
      case 'edit':
        break;
      case 'cancel':
        meta?.revertData(row.index);
        break;
      case 'done':
        // Don't clear edit state here - updateRow will handle it on success
        meta?.updateRow(row.index);
        break;
    }

    e.preventDefault();
    e.stopPropagation();
  };

  const removeRow = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await meta?.removeRow(row.index);
      setShowDeleteConfirm(false);
    } catch (error) {
      // Error handling is done in the removeRow function
      console.error('Delete error:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Try to get meaningful details for the confirmation dialog
  const getRowDetails = () => {
    const original = row.original as any;
    const details: { [key: string]: string | undefined } = {};

    if (original.datePaid) {
      const date =
        original.datePaid instanceof Date
          ? original.datePaid.toLocaleDateString()
          : String(original.datePaid);
      details.date = date;
    }

    if (original.amount) {
      details.amount = `$${Number(original.amount).toFixed(2)}`;
    }

    return details;
  };

  return (
    <>
      <div className='flex justify-center items-center gap-1'>
        {meta?.editedRows.get(row.index) ? (
          <div className='flex gap-1'>
            <button
              className={`${tableCellStyles.actions.iconButton} ${tableCellStyles.actions.cancelButton}`}
              onClick={setEditedRows}
              name='cancel'
              aria-label='Cancel editing'
              title='Cancel'
            >
              <FaUndo size={12} />
            </button>
            <button
              className={`${tableCellStyles.actions.iconButton} ${tableCellStyles.actions.saveButton}`}
              onClick={setEditedRows}
              name='done'
              disabled={disableSubmit}
              aria-label='Save changes'
              title='Save'
            >
              <FaSave size={12} />
            </button>
          </div>
        ) : (
          <div className='flex gap-1'>
            <button
              className={`${tableCellStyles.actions.iconButton} ${tableCellStyles.actions.editButton}`}
              onClick={setEditedRows}
              name='edit'
              aria-label='Edit row'
              title='Edit'
            >
              <FaPen size={12} />
            </button>
            <button
              className={`${tableCellStyles.actions.iconButton} ${tableCellStyles.actions.deleteButton}`}
              onClick={removeRow}
              name='remove'
              aria-label='Delete row'
              title='Delete'
            >
              <FaTrash size={12} />
            </button>
          </div>
        )}
      </div>

      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title='Delete Payment'
        message='Are you sure you want to delete this payment record? This action cannot be undone.'
        details={getRowDetails()}
        confirmButtonText='Delete Payment'
        cancelButtonText='Cancel'
        variant='danger'
        isLoading={isDeleting}
      />
    </>
  );
};
