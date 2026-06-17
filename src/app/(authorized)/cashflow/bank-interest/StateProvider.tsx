'use client';

import type { Dispatch } from 'react';
import { createContext, useContext, useEffect, useReducer } from 'react';

import type { BankInterestType } from './_types';
import type { Actions, BankInterestState } from './reducer';
import { bankInterestReducer } from './reducer';

const BankInterestStateContext = createContext<{
  state: BankInterestState;
  dispatch: Dispatch<Actions>;
}>({
  state: { data: [] },
  dispatch: () => null,
});

type BankInterestStateProviderProps = {
  data: Array<BankInterestType>;
  children?: React.ReactNode;
};

export const BankInterestStateProvider = ({
  data: initialData,
  children,
}: BankInterestStateProviderProps) => {
  const [bankInterestDetails, dispatch] = useReducer(bankInterestReducer, {
    data: initialData,
  });

  useEffect(() => {
    dispatch({
      type: 'BANK_INTEREST/INITAL_DATA',
      payload: { data: initialData },
    });
  }, [initialData]);

  return (
    <BankInterestStateContext.Provider
      value={{ state: { ...bankInterestDetails }, dispatch }}
    >
      {children}
    </BankInterestStateContext.Provider>
  );
};

export const useBankInterestState = () => useContext(BankInterestStateContext);
