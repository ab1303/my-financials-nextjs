import type { ActionMapUnion } from '@/types';

import type { DonationPaymentType } from './_types';

import { produce } from 'immer';

type DonationMessages = {
  'DONATION/Payments/INITAL_DATA': DonationPaymentsState;
  'DONATION/Payments/ADD_PAYMENT': {
    donationPaymentId: string;
    payment: DonationPaymentType;
  };
  'DONATION/Payments/EDIT_PAYMENT': {
    donationPaymentId: string;
    payment: DonationPaymentType;
  };
  'DONATION/Payments/REMOVE_PAYMENT': {
    donationPaymentId: string;
  };
};

export type DonationPaymentsState = {
  data: Array<DonationPaymentType>;
};

export type Actions = ActionMapUnion<DonationMessages>;

export const donationPaymentReducer = produce<DonationPaymentsState, [Actions]>(
  (draft, action) => {
    switch (action.type) {
      case 'DONATION/Payments/INITAL_DATA': {
        draft.data = action.payload.data;
        break;
      }
      case 'DONATION/Payments/ADD_PAYMENT': {
        const { payment } = action.payload;
        draft.data.push(payment);
        break;
      }

      case 'DONATION/Payments/EDIT_PAYMENT': {
        const { payment, donationPaymentId } = action.payload;
        const editedPayment = draft.data.find(
          (d) => d.id === donationPaymentId,
        );

        if (!editedPayment) return;

        editedPayment.amount = payment.amount;
        editedPayment.beneficiaryType = payment.beneficiaryType;
        editedPayment.beneficiaryId = payment.beneficiaryId;
        editedPayment.taxCategory = payment.taxCategory;
        editedPayment.datePaid = payment.datePaid;
        break;
      }

      case 'DONATION/Payments/REMOVE_PAYMENT': {
        const { donationPaymentId } = action.payload;
        draft.data = draft.data.filter((d) => d.id !== donationPaymentId);
        break;
      }

      default:
        return draft;
    }
  },
);
