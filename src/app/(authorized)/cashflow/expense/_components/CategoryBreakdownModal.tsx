'use client';







import { Fragment, useCallback, useEffect, useId, useMemo, useState } from 'react';



import type { ReactNode } from 'react';



import Link from 'next/link';



import { Dialog, Transition } from '@headlessui/react';



import { toast } from 'sonner';



import { NumericFormat } from 'react-number-format';



import { AppSelect as Select } from '@/components/ui/AppSelect';



import { X } from 'lucide-react';



import clsx from 'clsx';







import Portal from '@/components/Portal';



import { Label } from '@/components/ui';



import { AddIcon, PenIcon, CheckIcon, TrashIcon } from '@/components/icons';



import { ArrowUpDown } from 'lucide-react';



import { cardStyles } from '@/styles/theme';



import { cn } from '@/lib/utils';



import { inputStyles, buttonStyles } from '@/styles/theme';



import ImportAuditIcon from '@/components/ImportAuditIcon';



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



  monthYear: number;



  isOpen: boolean;



  onClose: () => void;



};







type ExpenseEntryFormData = {



  id: string;



  categoryId: string;



  categoryName: string;



  amount: number;



};







type CategoryBreakdownDialogProps = {



  title: string;



  onClose: () => void;



  children: ReactNode;



  footer?: ReactNode;



};







const defaultEntry: ExpenseEntryFormData = {



  id: '',



  categoryId: '',



  categoryName: '',



  amount: 0,



};







function CategoryBreakdownDialog({



  title,



  onClose,



  children,



  footer,



}: CategoryBreakdownDialogProps) {



  return (



    <Portal>



      <Transition appear show as={Fragment}>



        <Dialog onClose={onClose} className='relative z-50'>



          <Transition.Child



            as={Fragment}



            enter='ease-out duration-300'



            enterFrom='opacity-0'



            enterTo='opacity-100'



            leave='ease-in duration-200'



            leaveFrom='opacity-100'



            leaveTo='opacity-0'



          >



            <div className='fixed inset-0 bg-black/50' />



          </Transition.Child>







          <div className='fixed inset-0 flex items-center justify-center p-4'>



            <Transition.Child



              as={Fragment}



              enter='ease-out duration-300'



              enterFrom='opacity-0 scale-95'



              enterTo='opacity-100 scale-100'



              leave='ease-in duration-200'



              leaveFrom='opacity-100 scale-100'



              leaveTo='opacity-0 scale-95'



            >



              <Dialog.Panel className='flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-background shadow-xl ring-1 ring-border'>



                <div className='flex items-center justify-between border-b border-border px-6 py-4'>



                  <Dialog.Title as='h2' className='text-lg font-semibold text-foreground'>



                    {title}



                  </Dialog.Title>



                  <button



                    type='button'



                    onClick={onClose}



                    className='rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground'



                    aria-label='Close dialog'



                  >



                    <X className='h-5 w-5' />



                  </button>



                </div>







                <div className='flex-1 max-h-[85vh] overflow-y-auto px-6 py-5'>



                  {children}



                </div>







                {footer ? (



                  <div className='border-t border-border px-6 py-4'>



                    {footer}



                  </div>



                ) : null}



              </Dialog.Panel>



            </Transition.Child>



          </div>



        </Dialog>



      </Transition>



    </Portal>



  );



}







export function buildCategoryTransactionHref(categoryName: string, month: number, year: number = new Date().getFullYear()) {
  return `/cashflow/transactions?category=${encodeURIComponent(categoryName.toLowerCase())}&month=${month}&year=${year}`;
}

function CategoryBreakdownContent({



  calendarYearId,



  month,



  monthName,



  monthYear,



  onClose,



}: Omit<CategoryBreakdownModalProps, 'isOpen'>) {



  const selectId = useId();



  const [editEntryId, setEditEntryId] = useState<string | null>(null);



  const [entryForm, setEntryForm] = useState<ExpenseEntryFormData>(defaultEntry);



  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);



  const [isLoading, setIsLoading] = useState(false);



  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');







  const { state, dispatch } = useExpenseEntryState();







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



    const result = await addRow({ calendarYearId, month, categoryId: entryForm.categoryId, amount: entryForm.amount });



    if (result.success && result.data) {



      const categoryName = categories.find((c) => c.id === entryForm.categoryId)?.name || '';



      dispatch({ type: 'EXPENSE/Entries/ADD_ENTRY', payload: { entry: { ...result.data, categoryName } } });



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



    const result = await editRow({ id: entryId, categoryId: entryForm.categoryId, amount: entryForm.amount });



    if (result.success && result.data) {



      const categoryName = categories.find((c) => c.id === entryForm.categoryId)?.name || '';



      dispatch({ type: 'EXPENSE/Entries/EDIT_ENTRY', payload: { expenseEntryId: entryId, entry: { categoryId: entryForm.categoryId, amount: entryForm.amount, categoryName } } });



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



    const result = await deleteRow({ id: entryId, calendarYearId });



    if (result.success) {



      dispatch({ type: 'EXPENSE/Entries/REMOVE_ENTRY', payload: { expenseEntryId: entryId } });



      toast.success('Expense entry deleted');



    } else {



      toast.error(result.error || 'Failed to delete expense entry');



    }



    setIsLoading(false);



  };







  const startEdit = (entry: ExpenseEntryWithCategory) => {



    setEditEntryId(entry.id);



    setEntryForm({ id: entry.id, categoryId: entry.categoryId, categoryName: entry.categoryName, amount: entry.amount });



  };







  const cancelEdit = () => {



    setEditEntryId(null);



    setEntryForm(defaultEntry);



  };







  const totalAmount = state.data.reduce((sum, entry) => sum + entry.amount, 0);







  const sortedEntries = useMemo(



    () =>



      [...state.data].sort((a, b) =>



        sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount,



      ),



    [state.data, sortOrder],



  );







  const toggleSort = useCallback(



    () => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc')),



    [],



  );







  return (



    <CategoryBreakdownDialog



      title={`Expenses for ${monthName}`}



      onClose={onClose}



      footer={



        <div className='flex items-center justify-between w-full'>



          <span className='text-lg font-bold'>



            Total: <NumericFormat prefix='$' displayType='text' thousandSeparator value={totalAmount.toFixed(2)} />



          </span>



          <button type='button' className={clsx(buttonStyles.primary)} onClick={onClose}>



            Close



          </button>



        </div>



      }



    >



      <div className='space-y-6'>



        {editEntryId === null && (



          <div className='rounded-lg border border-border bg-muted/50 p-4'>



            <div className='mb-3'>



              <span className='text-sm font-semibold text-muted-foreground'>Add New Expense</span>



            </div>



            <div className='grid grid-cols-12 items-end gap-3'>



              <div className='col-span-5'>



                <Label className='mb-1 text-xs text-muted-foreground'>Category</Label>



                <Select<OptionType>



                  instanceId={`category-add-${selectId}`}



                  options={categoryOptions}



                  value={categoryOptions.find((opt) => opt.id === entryForm.categoryId) || null}



                  onChange={(option) => { if (option) setEntryForm({ ...entryForm, categoryId: option.id, categoryName: option.label }); }}



                  getOptionValue={(option) => option.id}



                  placeholder='Select category...'



                  menuPortalTarget={document.body}



                  menuPosition='fixed'



                  styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999, pointerEvents: 'auto' }) as typeof base }}



                />



              </div>



              <div className='col-span-4'>



                <Label className='mb-1 text-xs text-muted-foreground'>Amount $</Label>



                <NumericFormat className={cn(inputStyles.base)} prefix='$' displayType='input' thousandSeparator value={entryForm.amount || ''} onValueChange={(values) => setEntryForm({ ...entryForm, amount: values.floatValue || 0 })} />



              </div>



              <div className='col-span-3'>



                <button type='button' className={clsx(buttonStyles.iconAdd, 'w-full')} onClick={handleAddEntry} disabled={isLoading} aria-label='Add expense'>



                  <AddIcon />



                </button>



              </div>



            </div>



          </div>



        )}







        <div>



          {state.data.length === 0 ? (



            <div className='py-12 text-center text-muted-foreground'>



              <p className='text-sm'>No expenses recorded for this month. Click + to add your first expense.</p>



            </div>



          ) : (



            <>



              {/* Sort control */}



              <div className='mb-2 flex items-center justify-end'>



                <button



                  type='button'



                  onClick={toggleSort}



                  className='inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground'



                  aria-label={`Sort by amount ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}



                >



                  <ArrowUpDown className='h-3.5 w-3.5' />



                  Amount {sortOrder === 'asc' ? '↑' : '↓'}



                </button>



              </div>







            <div className='space-y-3'>



              {sortedEntries.map((entry) => (



                <div key={entry.id} className='flex items-center space-x-3'>



                  <div className={clsx('h-16 w-1 rounded-full', editEntryId === entry.id ? 'bg-teal-500' : 'bg-gray-300')} />



                  <div className={cardStyles.tile} data-tile>



                    {editEntryId === entry.id ? (



                      <div className='grid grid-cols-12 items-center gap-3'>



                        <div className='col-span-5'>



                          <Select<OptionType>



                            instanceId={`category-edit-${selectId}`}



                            options={categoryOptions}



                            value={categoryOptions.find((opt) => opt.id === entryForm.categoryId) || null}



                            onChange={(option) => { if (option) setEntryForm({ ...entryForm, categoryId: option.id, categoryName: option.label }); }}



                            getOptionValue={(option) => option.id}



                            placeholder='Select category...'



                            menuPortalTarget={document.body}



                            menuPosition='fixed'



                            styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999, pointerEvents: 'auto' }) as typeof base }}



                          />



                        </div>



                        <div className='col-span-4'>



                          <NumericFormat className={cn(inputStyles.base, 'text-right')} prefix='$' displayType='input' thousandSeparator value={entryForm.amount} onValueChange={(values) => setEntryForm({ ...entryForm, amount: values.floatValue || 0 })} />



                        </div>



                        <div className='col-span-3 flex justify-end gap-2'>



                          <button type='button' className={clsx(buttonStyles.iconCompact, 'text-muted-foreground hover:bg-muted/30 hover:text-primary')} onClick={() => handleEditEntry(entry.id)} disabled={isLoading} aria-label='Save changes'>



                            <CheckIcon className='h-5 w-5' />



                          </button>



                          <button type='button' className={clsx(buttonStyles.iconCompact, 'text-muted-foreground hover:bg-muted/30 hover:text-foreground')} onClick={cancelEdit} disabled={isLoading} aria-label='Cancel edit'>



                            <span className='text-xl'>×</span>



                          </button>



                        </div>



                      </div>



                    ) : (



                      <div className='flex items-center gap-3'>



                        <Link



                          href={buildCategoryTransactionHref(entry.categoryName, month, monthYear)}



                          className='flex-1 text-sm font-medium text-teal-600 transition-colors hover:text-teal-700 hover:underline dark:text-teal-400 dark:hover:text-teal-300'



                          aria-label={`View transactions for ${entry.categoryName}`}



                        >



                          {entry.categoryName}



                        </Link>



                        <span className='w-28 text-right text-lg font-semibold text-foreground tabular-nums'>



                          <NumericFormat prefix='$' displayType='text' thousandSeparator value={entry.amount.toFixed(2)} />



                        </span>



                        <div className='flex items-center gap-1'>



                          {entry.importImageId && <ImportAuditIcon importImageId={entry.importImageId} fileName={entry.importImage?.fileName} />}



                          <button type='button' className={clsx(buttonStyles.iconCompact, 'text-muted-foreground hover:bg-muted/30 hover:text-primary')} onClick={() => startEdit(entry)} disabled={isLoading} aria-label='Edit entry'><PenIcon className='h-5 w-5' /></button>



                          <button type='button' className={clsx(buttonStyles.iconCompact, 'text-muted-foreground hover:bg-muted/30 hover:text-destructive')} onClick={() => handleDeleteEntry(entry.id)} disabled={isLoading} aria-label='Delete entry'><TrashIcon className='h-5 w-5' /></button>



                        </div>



                      </div>



                    )}



                  </div>



                </div>



              ))}



            </div>



            </>



          )}



        </div>



      </div>



    </CategoryBreakdownDialog>



  );



}







export default function CategoryBreakdownModal(props: CategoryBreakdownModalProps) {



  const [entries, setEntries] = useState<ExpenseEntryWithCategory[]>([]);



  const [isLoading, setIsLoading] = useState(true);







  useEffect(() => {



    const loadEntries = async () => {



      setIsLoading(true);



      const result = await getMonthEntries(props.calendarYearId, props.month);



      setEntries(result.data || []);



      setIsLoading(false);



    };



    if (props.isOpen) loadEntries();



  }, [props.isOpen, props.calendarYearId, props.month]);







  if (!props.isOpen) return null;







  if (isLoading) {



    return (



      <CategoryBreakdownDialog title={`Expenses for ${props.monthName}`} onClose={props.onClose}>



        <div className='py-8 text-center'>Loading...</div>



      </CategoryBreakdownDialog>



    );



  }







  return (



    <ExpenseEntryStateProvider data={entries}>



      <CategoryBreakdownContent {...props} />



    </ExpenseEntryStateProvider>



  );



}











