import type { ActionMapUnion } from '@/types';

import type { ZakatPaymentType } from './_types';

import { produce } from 'immer';

type ZakatMessages = {
  'ZAKAT/Payments/INITAL_DATA': ZakatPaymentsState;
  'ZAKAT/Payments/ADD_PAYMENT': {
    zakatPaymentId: string;
    payment: ZakatPaymentType;
  };
  'ZAKAT/Payments/EDIT_PAYMENT': {
    zakatPaymentId: string;
    payment: ZakatPaymentType;
  };
  'ZAKAT/Payments/REMOVE_PAYMENT': {
    zakatPaymentId: string;
  };
};

export type ZakatPaymentsState = {
  data: Array<ZakatPaymentType>;
};

export type Actions = ActionMapUnion<ZakatMessages>;

export const zakatPaymentReducer = produce<ZakatPaymentsState, [Actions]>(
  (draft, action) => {
    switch (action.type) {
      case 'ZAKAT/Payments/INITAL_DATA': {
        draft.data = action.payload.data;
        break;
      }
      case 'ZAKAT/Payments/ADD_PAYMENT': {
        const { payment } = action.payload;
        draft.data.push(payment);
        break;
      }

      case 'ZAKAT/Payments/EDIT_PAYMENT': {
        const { payment, zakatPaymentId } = action.payload;
        const editedPayment = draft.data.find((d) => d.id === zakatPaymentId);

        if (!editedPayment) return;

        editedPayment.amount = payment.amount;
        editedPayment.beneficiaryType = payment.beneficiaryType;
        editedPayment.beneficiaryId = payment.beneficiaryId;
        editedPayment.datePaid = payment.datePaid;
        break;
      }

      case 'ZAKAT/Payments/REMOVE_PAYMENT': {
        const { zakatPaymentId } = action.payload;
        draft.data = draft.data.filter((d) => d.id !== zakatPaymentId);
        break;
      }

      default:
        return draft;
    }
  }
);
