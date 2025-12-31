'use client';

import { createContext, useContext, useEffect, useReducer } from 'react';
import type { Dispatch } from 'react';

import { incomeEntryReducer } from './reducer';
import type { Actions, IncomeEntriesState } from './reducer';
import type { IncomeEntryType } from './_types';

const IncomeEntryStateContext = createContext<{
  state: IncomeEntriesState;
  dispatch: Dispatch<Actions>;
}>({
  state: { data: [] },
  dispatch: () => null,
});

type IncomeEntryStateProviderProps = {
  data: Array<IncomeEntryType>;
  children?: React.ReactNode;
};

export const IncomeEntryStateProvider = ({
  data: initialData,
  children,
}: IncomeEntryStateProviderProps) => {
  const [incomeEntryDetails, dispatch] = useReducer(incomeEntryReducer, {
    data: initialData,
  });

  useEffect(() => {
    dispatch({
      type: 'INCOME/Entries/INITIAL_DATA',
      payload: { data: initialData },
    });
  }, [initialData]);

  return (
    <IncomeEntryStateContext.Provider
      value={{ state: { ...incomeEntryDetails }, dispatch }}
    >
      {children}
    </IncomeEntryStateContext.Provider>
  );
};

export const useIncomeEntryState = () => useContext(IncomeEntryStateContext);
