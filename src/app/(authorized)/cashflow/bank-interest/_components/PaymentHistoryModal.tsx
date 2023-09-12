import { Card, Modal } from '@/components';

import type { PaymentHistoryType } from '../_hooks/useBankInterestTableData';

type PaymentHistoryModalProps = {
  selectedMonth: number | null;
  paymentHistory: Array<PaymentHistoryType>;
  onClose: (updatedPaymentHistory: Array<PaymentHistoryType>) => void;
};

export default function PaymentHistoryModal({
  selectedMonth,
  paymentHistory,
}: PaymentHistoryModalProps) {
  return (
    <Modal show={!!selectedMonth}>
      <Modal.Header
        onClose={() => {
            // TODO
          return;
        }}
      >
        <Card.Header.Title>Payment History</Card.Header.Title>
      </Modal.Header>
      <Modal.Body>
        {paymentHistory.map((record) => (
          <div key={record.datePaid.toDateString()} className='flex flex-row'>
            <div className='mt-4 w-2 bg-orange-300'></div>
            <div className='bg-white flex flex-row flex-1 align-middle shadow mt-4 py-4 px-6 sm:px-10'>
              <span>{record.datePaid.toDateString()}</span>
              <span>{record.amount}</span>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='w-6 h-6 cursor-pointer'
                viewBox='0 0 24 24'
                fill='currentColor'
                onClick={() => {
                  return;
                }}
              >
                <path
                  fillRule='evenodd'
                  d='M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z'
                  clipRule='evenodd'
                />
              </svg>
            </div>
          </div>
        ))}
      </Modal.Body>
    </Modal>
  );
}
