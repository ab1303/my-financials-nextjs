'use client';

import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

import type { CleanseDonationDrawerProps } from './types';
import { useCleanseDonationState } from './useCleanseDonationState';

type CleanseDonationContextType = ReturnType<typeof useCleanseDonationState>;

const CleanseDonationContext = createContext<CleanseDonationContextType | null>(null);

export function CleanseDonationProvider({
  children,
  ...props
}: CleanseDonationDrawerProps & { children: ReactNode }) {
  const state = useCleanseDonationState(props);
  return (
    <CleanseDonationContext.Provider value={state}>
      {children}
    </CleanseDonationContext.Provider>
  );
}

export function useCleanseDonation() {
  const context = useContext(CleanseDonationContext);
  if (!context) {
    throw new Error('useCleanseDonation must be used within a CleanseDonationProvider');
  }
  return context;
}
