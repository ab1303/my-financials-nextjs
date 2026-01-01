'use client';

import { createContext, useContext, useEffect, useReducer } from 'react';
import type { Dispatch } from 'react';

import { expenseEntryReducer } from './reducer';
import type { Actions, ExpenseEntriesState } from './reducer';
import type { ExpenseEntryWithCategory } from '@/server/models/expense';

const ExpenseEntryStateContext = createContext<{
  state: ExpenseEntriesState;
  dispatch: Dispatch<Actions>;
}>({
  state: { data: [] },
  dispatch: () => null,
});

type ExpenseEntryStateProviderProps = {
  data: Array<ExpenseEntryWithCategory>;
  children?: React.ReactNode;
};

export const ExpenseEntryStateProvider = ({
  data: initialData,
  children,
}: ExpenseEntryStateProviderProps) => {
  const [expenseEntryDetails, dispatch] = useReducer(expenseEntryReducer, {
    data: initialData,
  });

  useEffect(() => {
    dispatch({
      type: 'EXPENSE/Entries/INITIAL_DATA',
      payload: { data: initialData },
    });
  }, [initialData]);

  return (
    <ExpenseEntryStateContext.Provider
      value={{ state: { ...expenseEntryDetails }, dispatch }}
    >
      {children}
    </ExpenseEntryStateContext.Provider>
  );
};

export const useExpenseEntryState = () => useContext(ExpenseEntryStateContext);
