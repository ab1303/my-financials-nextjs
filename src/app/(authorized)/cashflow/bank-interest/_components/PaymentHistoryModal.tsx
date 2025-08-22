import clsx from 'clsx';
import { toast } from 'react-toastify';
import { useEffect, useState } from 'react';
import { NumericFormat } from 'react-number-format';

import { Card } from '@/components';
import { Modal, Label } from '@/components/ui';
import { AddIcon, PenIcon, CheckIcon, TrashIcon } from '@/components/icons';
import DatePickerDialog from '@/components/DatePickerDialog';
import { trpc } from '@/server/trpc/client';
import { TRPCError } from '@trpc/server';
import { inputStyles, buttonStyles } from '@/styles/theme';

import { useBankInterestState } from '../StateProvider';
import type { PaymentHistoryType } from '../_types';

type PaymentType = Omit<PaymentHistoryType, 'id'>;

type AddEditPaymentProps = {
  selectedPayment: PaymentHistoryType;
  onConfirmPayment: (updatedPayment: PaymentType) => void;
  onAddPayment: (newPayment: PaymentType) => void;
};

function AddEditPayment({
  selectedPayment,
  onConfirmPayment,
  onAddPayment,
}: AddEditPaymentProps) {
  const [payment, setPayment] = useState<PaymentType>(selectedPayment);

  useEffect(() => {
    setPayment({ ...selectedPayment });
  }, [selectedPayment]);

  return (
    <>
      <div className='grid grid-cols-8 gap-4 mb-2'>
        <div className='col-span-3'>
          <Label>Date</Label>
        </div>
        <div className='col-span-4'>
          <Label>Amount $</Label>
        </div>
      </div>
      <div className='grid grid-cols-8 gap-4 items-end'>
        <div className='col-span-3'>
          <DatePickerDialog
            selectedDate={payment.datePaid}
            onDateChange={(d) => {
              setPayment((previousPayment) => ({
                ...previousPayment,
                datePaid: d,
              }));
            }}
          />
        </div>
        <div className='col-span-4'>
          <NumericFormat
            className={inputStyles.base}
            itemRef=''
            prefix='$'
            displayType='input'
            thousandSeparator
            value={payment.amount}
            onValueChange={(values) => {
              setPayment((previousPayment) => ({
                ...previousPayment,
                amount: values.floatValue || 0,
              }));
            }}
          />
        </div>
        <div className='col-span-1'>
          {/* https://stackoverflow.com/questions/65230250/onclick-event-handler-not-work-as-expected-when-attached-to-svg-icon-in-react */}
          {!!selectedPayment.id ? (
            <button
              type='button'
              className={clsx(
                buttonStyles.icon,
                'bg-teal-100 text-teal-600 hover:bg-teal-200 hover:text-teal-700 focus:ring-teal-500',
              )}
              onClick={() => onConfirmPayment(payment)}
            >
              <CheckIcon />
            </button>
          ) : (
            <button
              type='button'
              className={clsx(
                buttonStyles.icon,
                'bg-green-100 text-green-600 hover:bg-green-200 hover:text-green-700 focus:ring-green-500',
              )}
              onClick={() => onAddPayment({ ...payment })}
            >
              <AddIcon />
            </button>
          )}
        </div>
      </div>
    </>
  );
}

type PaymentHistoryModalProps = {
  bankInterestId: string;
  paymentHistory: Array<PaymentHistoryType>;
  onClose: () => void;
};

const defaultPayment: PaymentHistoryType = {
  id: '',
  amount: 0,
  datePaid: new Date(),
  businessId: null,
};

export default function PaymentHistoryModal({
  bankInterestId,
  paymentHistory,
  onClose,
}: PaymentHistoryModalProps) {
  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);

  const { dispatch } = useBankInterestState();

  const addPaymentMutation =
    trpc.bankInterest.addBankInterestPayment.useMutation({
      onError(error: unknown) {
        if (error instanceof TRPCError) {
          toast.error(error.message);
        }
      },

      onSuccess({ paymentId }, { amount, datePaid }) {
        toast.success('Interest payment detail created!');

        dispatch({
          type: 'BANK_INTEREST/Payments/ADD_PAYMENT',
          payload: {
            bankInterestId,
            payment: {
              amount,
              datePaid,
              businessId: 'to set', // TODO:
              id: paymentId,
            },
          },
        });
      },
    });

  const updatePaymentMutation =
    trpc.bankInterest.updateBankInterestPayment.useMutation({
      onError(error: unknown) {
        if (error instanceof TRPCError) {
          toast.error(error.message);
        }
      },

      onSuccess(_, { bankInterestId, paymentId, payment }) {
        toast.success('Interest payment detail updated!');

        dispatch({
          type: 'BANK_INTEREST/Payments/EDIT_PAYMENT',
          payload: {
            bankInterestId,
            paymentId,
            amount: payment,
          },
        });
      },
    });

  const removePaymentMutation =
    trpc.bankInterest.removeBankInterestPayment.useMutation({
      onError(error: unknown) {
        if (error instanceof TRPCError) {
          toast.error(error.message);
        }
      },

      onSuccess(_, { bankInterestId, paymentId }) {
        toast.success('Interest payment detail removed!');

        dispatch({
          type: 'BANK_INTEREST/Payments/REMOVE_PAYMENT',
          payload: {
            bankInterestId,
            paymentId,
          },
        });
      },
    });

  const handleAddPayment = (payment: PaymentType) => {
    const { amount, businessId, datePaid } = payment;
    addPaymentMutation.mutate({
      bankInterestId,
      amount,
      businessId,
      datePaid,
    });
  };

  const handleRemovePayment = (paymentId: string) => {
    removePaymentMutation.mutate({
      bankInterestId,
      paymentId,
    });
  };

  const handleConfirmPayment = (updatedPayment: PaymentType) => {
    if (!editPaymentId) return;

    updatePaymentMutation.mutate({
      bankInterestId,
      paymentId: editPaymentId,
      payment: updatedPayment.amount,
    });

    setEditPaymentId(null);
  };

  const selectedPayment: PaymentHistoryType = editPaymentId
    ? paymentHistory.find((p) => p.id === editPaymentId) || defaultPayment
    : defaultPayment;

  return (
    <Modal show={!!bankInterestId} onClose={onClose}>
      <Modal.Header>
        <Card.Header.Title>Payment History</Card.Header.Title>
      </Modal.Header>
      <Modal.Body>
        <AddEditPayment
          selectedPayment={selectedPayment}
          onAddPayment={handleAddPayment}
          onConfirmPayment={handleConfirmPayment}
        />

        <div className='space-y-3 mt-6'>
          {paymentHistory.map((record) => (
            <div key={record.id} className='flex items-center space-x-3'>
              <div
                className={clsx(
                  'w-1 h-16 rounded-full',
                  editPaymentId === record.id ? 'bg-teal-500' : 'bg-gray-300',
                )}
              ></div>
              <div className='flex-1 bg-white border border-gray-200 rounded-lg shadow-sm p-4'>
                <div className='flex justify-between items-center'>
                  <span className='text-sm font-medium text-gray-900'>
                    {record.datePaid.toDateString()}
                  </span>
                  <span className='text-lg font-semibold text-gray-900'>
                    <NumericFormat
                      prefix='$'
                      displayType='text'
                      thousandSeparator
                      value={record.amount}
                    />
                  </span>
                  <div className='flex space-x-3'>
                    <button
                      className={clsx(
                        buttonStyles.iconCompact,
                        'text-gray-400 hover:text-teal-600 hover:bg-gray-50 focus:ring-teal-500',
                      )}
                      onClick={() => setEditPaymentId(record.id)}
                    >
                      <PenIcon className='w-5 h-5' />
                    </button>
                    <button
                      className={clsx(
                        buttonStyles.iconCompact,
                        'text-gray-400 hover:text-red-600 hover:bg-gray-50 focus:ring-red-500',
                      )}
                      onClick={() => handleRemovePayment(record.id)}
                    >
                      <TrashIcon className='w-5 h-5' />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Modal.Body>
    </Modal>
  );
}
