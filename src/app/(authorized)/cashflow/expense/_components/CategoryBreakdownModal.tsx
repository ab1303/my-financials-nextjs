'use client';

import { useEffect, useState, useId } from 'react';
import { toast } from 'react-toastify';
import { NumericFormat } from 'react-number-format';
import Select from 'react-select';
import clsx from 'clsx';

import { Card } from '@/components';
import { Modal, Label } from '@/components/ui';
import { AddIcon, PenIcon, CheckIcon, TrashIcon } from '@/components/icons';
import { inputStyles, buttonStyles } from '@/styles/theme';
import ImportAuditIcon from './ai-import/ImportAuditIcon';
import {
  addRow,
  editRow,
  deleteRow,
  getExpenseCategories,
  getMonthEntries,
} from '../actions';

import {
  ExpenseEntryStateProvider,
  useExpenseEntryState,
} from '../StateProvider';
import type { ExpenseEntryWithCategory } from '@/server/models/expense';
import type { OptionType } from '@/types';

type CategoryBreakdownModalProps = {
  calendarYearId: string;
  month: number;
  monthName: string;
  isOpen: boolean;
  onClose: () => void;
};

type ExpenseEntryFormData = {
  id: string;
  categoryId: string;
  categoryName: string;
  amount: number;
};

const defaultEntry: ExpenseEntryFormData = {
  id: '',
  categoryId: '',
  categoryName: '',
  amount: 0,
};

function CategoryBreakdownContent({
  calendarYearId,
  month,
  monthName,
  onClose,
}: Omit<CategoryBreakdownModalProps, 'isOpen'>) {
  const selectId = useId();
  const [editEntryId, setEditEntryId] = useState<string | null>(null);
  const [entryForm, setEntryForm] =
    useState<ExpenseEntryFormData>(defaultEntry);
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  const { state, dispatch } = useExpenseEntryState();

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      const result = await getExpenseCategories();
      if (result.success && result.data) {
        setCategories(result.data);
      }
    };
    loadCategories();
  }, []);

  const categoryOptions: OptionType[] = categories.map((cat) => ({
    id: cat.id,
    label: cat.name,
  }));

  const handleAddEntry = async () => {
    if (!entryForm.categoryId || entryForm.amount <= 0) {
      toast.error('Please select a category and enter a valid amount');
      return;
    }

    setIsLoading(true);
    const result = await addRow({
      calendarYearId,
      month,
      categoryId: entryForm.categoryId,
      amount: entryForm.amount,
    });

    if (result.success && result.data) {
      const categoryName =
        categories.find((c) => c.id === entryForm.categoryId)?.name || '';

      dispatch({
        type: 'EXPENSE/Entries/ADD_ENTRY',
        payload: {
          entry: {
            ...result.data,
            categoryName,
          },
        },
      });

      toast.success('Expense entry added');
      setEntryForm(defaultEntry);
    } else {
      toast.error(result.error || 'Failed to add expense entry');
    }
    setIsLoading(false);
  };

  const handleEditEntry = async (entryId: string) => {
    if (!entryForm.categoryId || entryForm.amount <= 0) {
      toast.error('Please select a category and enter a valid amount');
      return;
    }

    setIsLoading(true);
    const result = await editRow({
      id: entryId,
      categoryId: entryForm.categoryId,
      amount: entryForm.amount,
    });

    if (result.success && result.data) {
      const categoryName =
        categories.find((c) => c.id === entryForm.categoryId)?.name || '';

      dispatch({
        type: 'EXPENSE/Entries/EDIT_ENTRY',
        payload: {
          expenseEntryId: entryId,
          entry: {
            categoryId: entryForm.categoryId,
            amount: entryForm.amount,
            categoryName,
          },
        },
      });

      toast.success('Expense entry updated');
      setEditEntryId(null);
      setEntryForm(defaultEntry);
    } else {
      toast.error(result.error || 'Failed to update expense entry');
    }
    setIsLoading(false);
  };

  const handleDeleteEntry = async (entryId: string) => {
    setIsLoading(true);
    const result = await deleteRow({
      id: entryId,
      calendarYearId,
    });

    if (result.success) {
      dispatch({
        type: 'EXPENSE/Entries/REMOVE_ENTRY',
        payload: {
          expenseEntryId: entryId,
        },
      });

      toast.success('Expense entry deleted');
    } else {
      toast.error(result.error || 'Failed to delete expense entry');
    }
    setIsLoading(false);
  };

  const startEdit = (entry: ExpenseEntryWithCategory) => {
    setEditEntryId(entry.id);
    setEntryForm({
      id: entry.id,
      categoryId: entry.categoryId,
      categoryName: entry.categoryName,
      amount: entry.amount,
    });
  };

  const cancelEdit = () => {
    setEditEntryId(null);
    setEntryForm(defaultEntry);
  };

  const totalAmount = state.data.reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <Modal show={true} onClose={onClose}>
      <Modal.Header>
        <Card.Header.Title>Expenses for {monthName}</Card.Header.Title>
      </Modal.Header>

      <Modal.Body className='space-y-6'>
        {/* Add New Entry Form - Top Position */}
        {editEntryId === null && (
          <div className='bg-gray-50 rounded-lg p-4 border border-gray-200'>
            <div className='mb-3'>
              <span className='text-sm font-semibold text-gray-700'>
                Add New Expense
              </span>
            </div>
            <div className='grid grid-cols-12 gap-3 items-end'>
              <div className='col-span-5'>
                <Label className='text-xs text-gray-600 mb-1'>Category</Label>
                <Select
                  instanceId={`category-add-${selectId}`}
                  options={categoryOptions}
                  value={
                    categoryOptions.find(
                      (opt) => opt.id === entryForm.categoryId,
                    ) || null
                  }
                  onChange={(option) => {
                    if (option) {
                      setEntryForm({
                        ...entryForm,
                        categoryId: option.id,
                        categoryName: option.label,
                      });
                    }
                  }}
                  getOptionValue={(option) => option.id}
                  placeholder='Select category...'
                  menuPortalTarget={document.body}
                  menuPosition='fixed'
                  styles={{
                    menuPortal: (base) =>
                      ({ ...base, zIndex: 9999 }) as typeof base,
                  }}
                />
              </div>
              <div className='col-span-4'>
                <Label className='text-xs text-gray-600 mb-1'>Amount $</Label>
                <NumericFormat
                  className={inputStyles.base}
                  prefix='$'
                  displayType='input'
                  thousandSeparator
                  value={entryForm.amount || ''}
                  onValueChange={(values) => {
                    setEntryForm({
                      ...entryForm,
                      amount: values.floatValue || 0,
                    });
                  }}
                />
              </div>
              <div className='col-span-3'>
                <button
                  type='button'
                  className={clsx(
                    buttonStyles.icon,
                    'bg-green-100 text-green-600 hover:bg-green-200 w-full',
                  )}
                  onClick={handleAddEntry}
                  disabled={isLoading}
                  aria-label='Add expense'
                >
                  <AddIcon />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Expense Entry List */}
        <div>
          {state.data.length === 0 ? (
            <div className='text-center py-12 text-gray-500'>
              <p className='text-sm'>
                No expenses recorded for this month. Click + to add your first
                expense.
              </p>
            </div>
          ) : (
            <div className='space-y-3'>
              {state.data.map((entry) => (
                <div key={entry.id} className='flex items-center space-x-3'>
                  <div
                    className={clsx(
                      'w-1 h-16 rounded-full',
                      editEntryId === entry.id ? 'bg-teal-500' : 'bg-gray-300',
                    )}
                  />
                  <div className='flex-1 bg-white border border-gray-200 rounded-lg shadow-sm p-4'>
                    {editEntryId === entry.id ? (
                      <div className='grid grid-cols-12 gap-3 items-center'>
                        {/* Edit Mode */}
                        <div className='col-span-5'>
                          <Select
                            instanceId={`category-edit-${selectId}`}
                            options={categoryOptions}
                            value={
                              categoryOptions.find(
                                (opt) => opt.id === entryForm.categoryId,
                              ) || null
                            }
                            onChange={(option) => {
                              if (option) {
                                setEntryForm({
                                  ...entryForm,
                                  categoryId: option.id,
                                  categoryName: option.label,
                                });
                              }
                            }}
                            getOptionValue={(option) => option.id}
                            placeholder='Select category...'
                            menuPortalTarget={document.body}
                            menuPosition='fixed'
                            styles={{
                              menuPortal: (base) =>
                                ({ ...base, zIndex: 9999 }) as typeof base,
                            }}
                          />
                        </div>
                        <div className='col-span-4'>
                          <NumericFormat
                            className={inputStyles.base}
                            prefix='$'
                            displayType='input'
                            thousandSeparator
                            value={entryForm.amount}
                            onValueChange={(values) => {
                              setEntryForm({
                                ...entryForm,
                                amount: values.floatValue || 0,
                              });
                            }}
                          />
                        </div>
                        <div className='col-span-3 flex gap-2 justify-end'>
                          <button
                            type='button'
                            className={clsx(
                              buttonStyles.iconCompact,
                              'text-gray-400 hover:text-teal-600 hover:bg-gray-50',
                            )}
                            onClick={() => handleEditEntry(entry.id)}
                            disabled={isLoading}
                            aria-label='Save changes'
                          >
                            <CheckIcon className='w-5 h-5' />
                          </button>
                          <button
                            type='button'
                            className={clsx(
                              buttonStyles.iconCompact,
                              'text-gray-400 hover:text-gray-600 hover:bg-gray-50',
                            )}
                            onClick={cancelEdit}
                            disabled={isLoading}
                            aria-label='Cancel edit'
                          >
                            <span className='text-xl'>×</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className='flex justify-between items-center'>
                        {/* Display Mode */}
                        <span className='text-sm font-medium text-gray-900'>
                          {entry.categoryName}
                        </span>
                        <span className='text-lg font-semibold text-gray-900'>
                          <NumericFormat
                            prefix='$'
                            displayType='text'
                            thousandSeparator
                            value={entry.amount.toFixed(2)}
                          />
                        </span>
                        <div className='flex space-x-3 items-center'>
                          {/* Import Audit Icon */}
                          {entry.importImageId && (
                            <ImportAuditIcon
                              importImageId={entry.importImageId}
                              fileName={entry.importImage?.fileName}
                            />
                          )}
                          <button
                            type='button'
                            className={clsx(
                              buttonStyles.iconCompact,
                              'text-gray-400 hover:text-teal-600 hover:bg-gray-50',
                            )}
                            onClick={() => startEdit(entry)}
                            disabled={isLoading}
                            aria-label='Edit entry'
                          >
                            <PenIcon className='w-5 h-5' />
                          </button>
                          <button
                            type='button'
                            className={clsx(
                              buttonStyles.iconCompact,
                              'text-gray-400 hover:text-red-600 hover:bg-gray-50',
                            )}
                            onClick={() => handleDeleteEntry(entry.id)}
                            disabled={isLoading}
                            aria-label='Delete entry'
                          >
                            <TrashIcon className='w-5 h-5' />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <div className='flex justify-between items-center w-full'>
          <span className='text-lg font-bold'>
            Total:{' '}
            <NumericFormat
              prefix='$'
              displayType='text'
              thousandSeparator
              value={totalAmount.toFixed(2)}
            />
          </span>
          <button
            type='button'
            className={clsx(buttonStyles.primary)}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}

export default function CategoryBreakdownModal(
  props: CategoryBreakdownModalProps,
) {
  const [entries, setEntries] = useState<ExpenseEntryWithCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadEntries = async () => {
      setIsLoading(true);
      const result = await getMonthEntries(props.calendarYearId, props.month);
      setEntries(result.data || []);
      setIsLoading(false);
    };

    if (props.isOpen) {
      loadEntries();
    }
  }, [props.isOpen, props.calendarYearId, props.month]);

  if (!props.isOpen) return null;

  if (isLoading) {
    return (
      <Modal show={true} onClose={props.onClose}>
        <Modal.Body>
          <div className='text-center py-8'>Loading...</div>
        </Modal.Body>
      </Modal>
    );
  }

  return (
    <ExpenseEntryStateProvider data={entries}>
      <CategoryBreakdownContent {...props} />
    </ExpenseEntryStateProvider>
  );
}
