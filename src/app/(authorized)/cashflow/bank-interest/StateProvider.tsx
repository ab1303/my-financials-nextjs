'use client';

import { createContext, useContext, useEffect, useReducer } from 'react';
import type { Dispatch } from 'react';

import { bankInterestReducer } from './reducer';
import type { Actions, BankInterestState } from './reducer';
import type { BankInterestType } from './_types';

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
