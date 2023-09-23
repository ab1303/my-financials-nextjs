import { useState } from 'react';
import { Modal, Label } from 'flowbite-react';

import { AddIcon, Card, TrashIcon } from '@/components';

import type { PaymentHistoryType } from '../_hooks/useBankInterestTableData';
import { NumericFormat } from 'react-number-format';
import { PenIcon } from '@/components/icons';
import clsx from 'clsx';
import CheckIcon from '@/components/icons/CheckIcon';
import DatePickerDialog from '@/components/DatePickerDialog';

type AddEditPaymentProps = {
  selectedPayment: PaymentHistoryType;
  onConfirmButtonClick: () => void;
  onAddButtonClick: () => void;
};

function AddEditPayment({
  selectedPayment,
  onAddButtonClick,
  onConfirmButtonClick,
}: AddEditPaymentProps) {
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
            selectedDate={selectedPayment.datePaid}
            onDateChange={(d) => {
              console.log('selected Date', d);
            }}
          />
        </div>
        <div className='col-span-3'>
          <NumericFormat
            prefix='$'
            displayType='input'
            thousandSeparator
            value={selectedPayment.amount}
          />
        </div>
        <div>
          {/* https://stackoverflow.com/questions/65230250/onclick-event-handler-not-work-as-expected-when-attached-to-svg-icon-in-react */}
          {!!selectedPayment.id ? (
            <button
              type='button'
              className='inline-block px-4 py-2.5 bg-gray-200 text-gray-700 font-medium text-xs leading-tight uppercase rounded shadow-md hover:bg-gray-300 hover:shadow-lg focus:bg-gray-300 focus:shadow-lg focus:outline-none focus:ring-0 active:bg-gray-400 active:shadow-lg transition duration-150 ease-in-out'
              onClick={onConfirmButtonClick}
            >
              <CheckIcon />
            </button>
          ) : (
            <button
              type='button'
              className='inline-block px-4 py-2.5 bg-gray-200 text-gray-700 font-medium text-xs leading-tight uppercase rounded shadow-md hover:bg-gray-300 hover:shadow-lg focus:bg-gray-300 focus:shadow-lg focus:outline-none focus:ring-0 active:bg-gray-400 active:shadow-lg transition duration-150 ease-in-out'
              onClick={onAddButtonClick}
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
  selectedMonth: number | null;
  paymentHistory: Array<PaymentHistoryType>;
  onClose: (updatedPaymentHistory: Array<PaymentHistoryType>) => void;
};

const defaultPayment: PaymentHistoryType = {
  id: 0,
  amount: 0,
  datePaid: new Date(),
  financialInstitutionId: '',
};

export default function PaymentHistoryModal({
  selectedMonth,
  paymentHistory,
  onClose,
}: PaymentHistoryModalProps) {
  const [editPaymentId, setEditPaymentId] = useState<number | null>(null);

  const onEditPaymentClick = (paymentId: number) => {
    setEditPaymentId(paymentId);
    const payment = paymentHistory.find((p) => p.id === paymentId);
    if (!payment) return;
  };

  const onConfirmPaymentClick = () => {
    setEditPaymentId(null);
  };

  const selectedPayment: PaymentHistoryType = editPaymentId
    ? paymentHistory.find((p) => p.id === editPaymentId) || defaultPayment
    : defaultPayment;

  return (
    <Modal show={!!selectedMonth} onClose={() => onClose(paymentHistory)}>
      <Modal.Header>
        <Card.Header.Title>Payment History</Card.Header.Title>
      </Modal.Header>
      <Modal.Body className='space-y-3'>
        <AddEditPayment
          selectedPayment={selectedPayment}
          onAddButtonClick={() => {
            return;
          }}
          onConfirmButtonClick={onConfirmPaymentClick}
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
                  onClick={() => onEditPaymentClick(record.id)}
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
