import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { Modal, Label } from 'flowbite-react';
import { NumericFormat } from 'react-number-format';

import { Card } from '@/components';
import { AddIcon, PenIcon, CheckIcon, TrashIcon } from '@/components/icons';
import DatePickerDialog from '@/components/DatePickerDialog';
import type { PaymentHistoryType } from '@/types';

type UpdatedPaymentType = Omit<PaymentHistoryType, 'id'>;

type AddEditPaymentProps = {
  selectedPayment: PaymentHistoryType;
  onConfirmButtonClick: (updatedPayment: UpdatedPaymentType) => void;
  onAddButtonClick: (newPayment: UpdatedPaymentType) => void;
};

function AddEditPayment({
  selectedPayment,
  onConfirmButtonClick,
}: AddEditPaymentProps) {
  const [updatedPayment, setUpdatedPayment] = useState<UpdatedPaymentType>(
    selectedPayment
  );

  useEffect(() => {
    setUpdatedPayment({ ...selectedPayment });
  }, [selectedPayment]);

  const handleConfirmButtonClick = () => {
    onConfirmButtonClick(updatedPayment);
  };

  const handleAddButtonClick = () => {
    return;
  };

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
            selectedDate={updatedPayment.datePaid}
            onDateChange={(d) => {
              setUpdatedPayment((previousPayment) => ({
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
            value={updatedPayment.amount}
            onValueChange={(values) => {
              setUpdatedPayment((previousPayment) => ({
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
              onClick={handleConfirmButtonClick}
            >
              <CheckIcon />
            </button>
          ) : (
            <button
              type='button'
              className='inline-block px-4 py-2.5 bg-gray-200 text-gray-700 font-medium text-xs leading-tight uppercase rounded shadow-md hover:bg-gray-300 hover:shadow-lg focus:bg-gray-300 focus:shadow-lg focus:outline-none focus:ring-0 active:bg-gray-400 active:shadow-lg transition duration-150 ease-in-out'
              onClick={handleAddButtonClick}
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
  onPaymentHistoryUpdate: (
    updatedPaymentHistory: Array<PaymentHistoryType>
  ) => void;
  onClose: () => void;
};

const defaultPayment: PaymentHistoryType = {
  id: '',
  amount: 0,
  datePaid: new Date(),
  businessId: '',
};

export default function PaymentHistoryModal({
  selectedMonth,
  paymentHistory,
  onPaymentHistoryUpdate,
  onClose,
}: PaymentHistoryModalProps) {
  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);

  const onEditPaymentClick = (paymentId: string) => {
    setEditPaymentId(paymentId);
    const payment = paymentHistory.find((p) => p.id === paymentId);
    if (!payment) return;
  };

  const onConfirmPaymentClick = (updatedPayment: UpdatedPaymentType) => {
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
    <Modal show={!!selectedMonth} onClose={onClose}>
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
