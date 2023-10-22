import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { Modal, Label } from 'flowbite-react';
import { NumericFormat } from 'react-number-format';

import { Card } from '@/components';
import { AddIcon, PenIcon, CheckIcon, TrashIcon } from '@/components/icons';
import DatePickerDialog from '@/components/DatePickerDialog';
import type { PaymentHistoryType } from '@/types';
import { useBankInterestState } from '../StateProvider';
import { trpcClient } from '@/server/trpc/client';
import { TRPCError } from '@trpc/server';
import { toast } from 'react-toastify';

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
      <div className='mt-3 grid grid-cols-7 gap-3'>
        <div className='col-span-3 px-2'>
          <Label>Date</Label>
        </div>
        <div className='col-span-3 px-2'>
          <Label>Amount $</Label>
        </div>
      </div>
      <div className='mt-3 grid grid-cols-7 gap-3'>
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
        <div className='col-span-3'>
          <NumericFormat
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
        <div>
          {/* https://stackoverflow.com/questions/65230250/onclick-event-handler-not-work-as-expected-when-attached-to-svg-icon-in-react */}
          {!!selectedPayment.id ? (
            <button
              type='button'
              className='inline-block px-4 py-2.5 bg-gray-200 text-gray-700 font-medium text-xs leading-tight uppercase rounded shadow-md hover:bg-gray-300 hover:shadow-lg focus:bg-gray-300 focus:shadow-lg focus:outline-none focus:ring-0 active:bg-gray-400 active:shadow-lg transition duration-150 ease-in-out'
              onClick={() => onConfirmPayment(payment)}
            >
              <CheckIcon />
            </button>
          ) : (
            <button
              type='button'
              className='inline-block px-4 py-2.5 bg-gray-200 text-gray-700 font-medium text-xs leading-tight uppercase rounded shadow-md hover:bg-gray-300 hover:shadow-lg focus:bg-gray-300 focus:shadow-lg focus:outline-none focus:ring-0 active:bg-gray-400 active:shadow-lg transition duration-150 ease-in-out'
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
  onPaymentHistoryUpdate: (
    updatedPaymentHistory: Array<PaymentHistoryType>
  ) => void;
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
  onPaymentHistoryUpdate,
  onClose,
}: PaymentHistoryModalProps) {
  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);

  const { dispatch } = useBankInterestState();

  const addPaymentMutation = trpcClient.bankInterest.addBankInterestPayment.useMutation(
    {
      onError(error: unknown) {
        if (error instanceof TRPCError) {
          toast.error(error.message);
        }
      },

      onSuccess({ paymentId }, { amount, datePaid }) {
        toast.success('Interest payment detail updated!');

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
    }
  );

  const handleAddPayment = (payment: PaymentType) => {
    const { amount, businessId, datePaid } = payment;
    addPaymentMutation.mutate({
      bankInterestId,
      amount,
      businessId,
      datePaid,
    });

    return;
  };

  const handleEditPayment = (paymentId: string) => {
    setEditPaymentId(paymentId);
    const payment = paymentHistory.find((p) => p.id === paymentId);
    if (!payment) return;
  };

  const handleConfirmPayment = (updatedPayment: PaymentType) => {
    const updatedPaymentHistory = paymentHistory.map((ph) => {
      if (ph.id !== editPaymentId) return ph;

      return {
        id: ph.id,
        ...updatedPayment,
      };
    });
    setEditPaymentId(null);
    onPaymentHistoryUpdate(updatedPaymentHistory);
  };

  const selectedPayment: PaymentHistoryType = editPaymentId
    ? paymentHistory.find((p) => p.id === editPaymentId) || defaultPayment
    : defaultPayment;

  return (
    <Modal show={!!bankInterestId} onClose={onClose}>
      <Modal.Header>
        <Card.Header.Title>Payment History</Card.Header.Title>
      </Modal.Header>
      <Modal.Body className='space-y-3'>
        <AddEditPayment
          selectedPayment={selectedPayment}
          onAddPayment={handleAddPayment}
          onConfirmPayment={handleConfirmPayment}
        />
        {/* // https://floating-ui.com/docs/FloatingList */}
        {paymentHistory.map((record) => (
          <div key={record.datePaid.toDateString()} className='flex flex-row'>
            <div
              className={clsx(
                'mt-2 w-2 ',
                editPaymentId === record.id ? 'bg-teal-500' : 'bg-orange-300'
              )}
            ></div>
            <div className='bg-white flex shadow w-full justify-between mt-2 py-4 px-6 sm:px-10'>
              <span>{record.datePaid.toDateString()}</span>
              <span>
                <NumericFormat
                  prefix='$'
                  displayType='text'
                  thousandSeparator
                  value={record.amount}
                />
              </span>
              <span className='flex justify-between flex-grow-0 w-10'>
                <PenIcon
                  className='hover:text-teal-500'
                  onClick={() => handleEditPayment(record.id)}
                />
                <TrashIcon className='hover:text-orange-800' />
              </span>
            </div>
          </div>
        ))}
      </Modal.Body>
    </Modal>
  );
}
