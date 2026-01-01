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
import {
  getMonthBreakdownHandler,
  expenseCategoriesHandler,
} from '@/server/controllers/expense.controller';
import { addRow, editRow, deleteRow } from '../actions';

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
      const cats = await expenseCategoriesHandler();
      if (cats) {
        setCategories(cats);
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

      <Modal.Body>
        {/* Expense Entry List */}
        <div className='space-y-3 mb-6'>
          {state.data.length === 0 && !entryForm.categoryId ? (
            <div className='text-center py-8 text-gray-500'>
              No expenses recorded for this month. Click + to add your first
              expense.
            </div>
          ) : (
            state.data.map((entry) => (
              <div
                key={entry.id}
                className='grid grid-cols-12 gap-3 items-center border-b pb-3'
              >
                {editEntryId === entry.id ? (
                  <>
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
                    <div className='col-span-3 flex gap-2'>
                      <button
                        type='button'
                        className={clsx(
                          buttonStyles.icon,
                          'bg-teal-100 text-teal-600 hover:bg-teal-200',
                        )}
                        onClick={() => handleEditEntry(entry.id)}
                        disabled={isLoading}
                      >
                        <CheckIcon />
                      </button>
                      <button
                        type='button'
                        className={clsx(
                          buttonStyles.icon,
                          'bg-gray-100 text-gray-600 hover:bg-gray-200',
                        )}
                        onClick={cancelEdit}
                        disabled={isLoading}
                      >
                        ×
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Display Mode */}
                    <div className='col-span-5 font-medium'>
                      {entry.categoryName}
                    </div>
                    <div className='col-span-4'>
                      <NumericFormat
                        prefix='$'
                        displayType='text'
                        thousandSeparator
                        value={entry.amount.toFixed(2)}
                      />
                    </div>
                    <div className='col-span-3 flex gap-2'>
                      <button
                        type='button'
                        className={clsx(
                          buttonStyles.icon,
                          'bg-blue-100 text-blue-600 hover:bg-blue-200',
                        )}
                        onClick={() => startEdit(entry)}
                        disabled={isLoading}
                        aria-label='Edit entry'
                      >
                        <PenIcon />
                      </button>
                      <button
                        type='button'
                        className={clsx(
                          buttonStyles.icon,
                          'bg-red-100 text-red-600 hover:bg-red-200',
                        )}
                        onClick={() => handleDeleteEntry(entry.id)}
                        disabled={isLoading}
                        aria-label='Delete entry'
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add New Entry Form */}
        {editEntryId === null && (
          <div className='border-t pt-4'>
            <Label className='mb-2'>Add New Expense</Label>
            <div className='grid grid-cols-12 gap-3 items-end'>
              <div className='col-span-5'>
                <Label>Category</Label>
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
                />
              </div>
              <div className='col-span-4'>
                <Label>Amount $</Label>
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
                >
                  <AddIcon />
                </button>
              </div>
            </div>
          </div>
        )}
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
      const data = await getMonthBreakdownHandler(
        props.calendarYearId,
        '', // userId will be fetched from session in handler
        props.month,
      );
      setEntries(data || []);
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
