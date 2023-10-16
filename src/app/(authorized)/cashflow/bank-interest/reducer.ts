import type { BankInterestType, ActionMapUnion } from '@/types';
import { produce } from 'immer';

type BankInterestMessages = {
  'BANK_INTEREST/INITAL_DATA': BankInterestState;
  'BANK_INTEREST/UPDATE_INTEREST_PAYMENT': {
    bankInterestId: string;
    amount: number;
  };
};

export type BankInterestState = {
  data: Array<BankInterestType>;
};

export type Actions = ActionMapUnion<BankInterestMessages>;

export const bankInterestReducer = produce<BankInterestState, [Actions]>(
  (draft, action) => {
    switch (action.type) {
      case 'BANK_INTEREST/INITAL_DATA':
        draft.data = action.payload.data;
        break;
      case 'BANK_INTEREST/UPDATE_INTEREST_PAYMENT':
        const { amount, bankInterestId } = action.payload;
        const updatedInterestPayment = draft.data.find(
          (r) => r.id === bankInterestId
        );
        if (updatedInterestPayment) {
          updatedInterestPayment.amountDue = amount;
        }
        break;
      default:
        return draft;
    }
  }
);
