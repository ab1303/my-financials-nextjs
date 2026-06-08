'use client';

import type { Dispatch } from 'react';
import { createContext, useContext, useEffect, useReducer } from 'react';

import type { ZakatPaymentType } from './_types';
import type { Actions, ZakatPaymentsState } from './reducer';
import { zakatPaymentReducer } from './reducer';

const ZakatPaymentStateContext = createContext<{
  state: ZakatPaymentsState;
  dispatch: Dispatch<Actions>;
}>({
  state: { data: [] },
  dispatch: () => null,
});

type ZakatPaymentStateProviderProps = {
  data: Array<ZakatPaymentType>;
  children?: React.ReactNode;
};

export const ZakatPaymentStateProvider = ({
  data: initialData,
  children,
}: ZakatPaymentStateProviderProps) => {
  const [bankInterestDetails, dispatch] = useReducer(zakatPaymentReducer, {
    data: initialData,
  });

  useEffect(() => {
    dispatch({
      type: 'ZAKAT/Payments/INITAL_DATA',
      payload: { data: initialData },
    });
  }, [initialData]);

  return (
    <ZakatPaymentStateContext.Provider
      value={{ state: { ...bankInterestDetails }, dispatch }}
    >
      {children}
    </ZakatPaymentStateContext.Provider>
  );
};

export const useZakatPaymentState = () => useContext(ZakatPaymentStateContext);
