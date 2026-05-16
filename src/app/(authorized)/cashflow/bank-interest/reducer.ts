import { produce } from 'immer';

import type { ActionMapUnion } from '@/types';

import type { BankInterestType } from './_types';

type BankInterestMessages = {
  'BANK_INTEREST/INITAL_DATA': BankInterestState;
  'BANK_INTEREST/SET_MANUAL_OVERRIDE': {
    bankInterestLiabilityId: string;
    manualOverride: number;
  };
  'BANK_INTEREST/ADD_CLEANSING_DONATION': {
    bankInterestLiabilityId: string;
    amountAdded: number;
    hasTransactionLink: boolean;
  };
};

export type BankInterestState = {
  data: Array<BankInterestType>;
};

export type Actions = ActionMapUnion<BankInterestMessages>;

export const bankInterestReducer = produce<BankInterestState, [Actions]>(
  (draft, action) => {
    switch (action.type) {
      case 'BANK_INTEREST/INITAL_DATA': {
        draft.data = action.payload.data;
        break;
      }
      case 'BANK_INTEREST/SET_MANUAL_OVERRIDE': {
        const { bankInterestLiabilityId, manualOverride } = action.payload;
        const row = draft.data.find((r) => r.id === bankInterestLiabilityId);
        if (row) {
          row.manualOverride = manualOverride;
          row.receivedTotal = row.receivedFromLedger + manualOverride;
          row.balance = Math.max(0, row.receivedTotal - row.amountCleansed);
        }
        break;
      }
      case 'BANK_INTEREST/ADD_CLEANSING_DONATION': {
        const { bankInterestLiabilityId, amountAdded, hasTransactionLink } =
          action.payload;
        const row = draft.data.find((r) => r.id === bankInterestLiabilityId);
        if (row) {
          row.amountCleansed += amountAdded;
          row.balance = Math.max(0, row.receivedTotal - row.amountCleansed);
          if (row.balance === 0) {
            row.status = hasTransactionLink ? 'CLEANSED' : 'MANUAL';
          } else {
            row.status = 'PARTIAL';
          }
          if (hasTransactionLink) {
            row.uncleansedTxCount = Math.max(0, row.uncleansedTxCount - 1);
          }
        }
        break;
      }
      default:
        return draft;
    }
  }
);
