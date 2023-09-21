import { Modal, Datepicker, Label } from 'flowbite-react';

import { AddIcon, Card, TrashIcon } from '@/components';

import type { PaymentHistoryType } from '../_hooks/useBankInterestTableData';
import { NumericFormat } from 'react-number-format';

type PaymentHistoryModalProps = {
  selectedMonth: number | null;
  paymentHistory: Array<PaymentHistoryType>;
  onClose: (updatedPaymentHistory: Array<PaymentHistoryType>) => void;
};

export default function PaymentHistoryModal({
  selectedMonth,
  paymentHistory,
  onClose,
}: PaymentHistoryModalProps) {
  return (
    <Modal show={!!selectedMonth} onClose={() => onClose(paymentHistory)}>
      <Modal.Header>
        <Card.Header.Title>Payment History</Card.Header.Title>
      </Modal.Header>
      <Modal.Body className='space-y-3'>
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
            <Datepicker />
          </div>
          <div className='col-span-3'>
            <NumericFormat prefix='$' displayType='input' thousandSeparator />
          </div>
          <div>
            <button
              type='button'
              className='inline-block px-4 py-2.5 bg-gray-200 text-gray-700 font-medium text-xs leading-tight uppercase rounded shadow-md hover:bg-gray-300 hover:shadow-lg focus:bg-gray-300 focus:shadow-lg focus:outline-none focus:ring-0 active:bg-gray-400 active:shadow-lg transition duration-150 ease-in-out'
            >
              <AddIcon />
            </button>
          </div>
        </div>

        {paymentHistory.map((record) => (
          <div key={record.datePaid.toDateString()} className='flex flex-row'>
            <div className='mt-2 w-2 bg-orange-300'></div>
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
              <TrashIcon className='hover:text-orange-800' />
            </div>
          </div>
        ))}
      </Modal.Body>
    </Modal>
  );
}
