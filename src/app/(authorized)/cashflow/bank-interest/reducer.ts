import type {
  BankInterestType,
  ActionMapUnion,
  PaymentHistoryType,
} from '@/types';
import { produce } from 'immer';

type BankInterestMessages = {
  'BANK_INTEREST/INITAL_DATA': BankInterestState;
  'BANK_INTEREST/UPDATE_INTEREST_PAYMENT': {
    bankInterestId: string;
    amount: number;
  };
  'BANK_INTEREST/Payments/ADD_PAYMENT': {
    bankInterestId: string;
    payment: PaymentHistoryType;
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
      case 'BANK_INTEREST/UPDATE_INTEREST_PAYMENT': {
        const { amount, bankInterestId } = action.payload;
        const updatedInterestPayment = draft.data.find(
          (r) => r.id === bankInterestId
        );
        if (updatedInterestPayment) {
          updatedInterestPayment.amountDue = amount;
        }
        break;
      }

      case 'BANK_INTEREST/Payments/ADD_PAYMENT': {
        const { bankInterestId, payment } = action.payload;
        const interestPaymentRow = draft.data.find(
          (r) => r.id === bankInterestId
        );

        if (interestPaymentRow) {
          interestPaymentRow.paymentHistory.push(payment);
          const paymentsTotal = interestPaymentRow.paymentHistory.reduce(
            (total, { amount }) => (total += amount),
            0
          );

          interestPaymentRow.amountPaid = paymentsTotal;
        }

        break;
      }

      default:
        return draft;
    }
  }
);
