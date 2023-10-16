import type { BankInterestType, ActionMapUnion } from '@/types';

// enum BankInterestEvents {
//   UPDATE_BANK_INTEREST_PAYMENT = 'BANK_INTEREST/UPDATE_INTEREST_PAYMENT',
//   ADD_INTEREST_PAYMENT = 'BANK_INTEREST_PAYMENTS/ADD_INTEREST_PAYMENT',
//   UPDATE_INTEREST_PAYMENT = 'BANK_INTEREST_PAYMENTS/UPDATE_INTEREST_PAYMENT',
// }

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

export const bankInterestReducer = (
  state: BankInterestState,
  action: Actions
): BankInterestState => {
  switch (action.type) {
    case 'BANK_INTEREST/INITAL_DATA':
      return { data: [...action.payload.data] };
    case 'BANK_INTEREST/UPDATE_INTEREST_PAYMENT':
      const { amount, bankInterestId } = action.payload;
      const updatedData = state.data.map((row) => {
        if (row.id === bankInterestId) {
          return {
            ...row,
            amountDue: amount,
          };
        }
        return row;
      });
      return { data: updatedData };
    default:
      return { ...state };
  }
};
