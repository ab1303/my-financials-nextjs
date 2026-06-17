'use client';

import type { Dispatch } from 'react';
import { createContext, useContext, useEffect, useReducer } from 'react';

import type { DonationPaymentType } from './_types';
import type { Actions, DonationPaymentsState } from './reducer';
import { donationPaymentReducer } from './reducer';

const DonationPaymentStateContext = createContext<{
  state: DonationPaymentsState;
  dispatch: Dispatch<Actions>;
}>({
  state: { data: [] },
  dispatch: () => null,
});

type DonationPaymentStateProviderProps = {
  data: Array<DonationPaymentType>;
  children?: React.ReactNode;
};

export const DonationPaymentStateProvider = ({
  data: initialData,
  children,
}: DonationPaymentStateProviderProps) => {
  const [donationPaymentDetails, dispatch] = useReducer(
    donationPaymentReducer,
    {
      data: initialData,
    },
  );

  useEffect(() => {
    dispatch({
      type: 'DONATION/Payments/INITAL_DATA',
      payload: { data: initialData },
    });
  }, [initialData]);

  return (
    <DonationPaymentStateContext.Provider
      value={{ state: { ...donationPaymentDetails }, dispatch }}
    >
      {children}
    </DonationPaymentStateContext.Provider>
  );
};

export const useDonationPaymentState = () =>
  useContext(DonationPaymentStateContext);
