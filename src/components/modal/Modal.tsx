import clsx from 'clsx';
import { useEffect } from 'react';
import { useState } from 'react';

import ModalBody from './ModalBody';
import ModalHeader from './ModalHeader/ModalHeader';

type ModalProps = {
  show: boolean;
  children: React.ReactNode | React.ReactNode[];
};

type CommonComponents = {
  Header: typeof ModalHeader;
  Body: typeof ModalBody;
};

const Modal: React.FC<ModalProps> & CommonComponents = ({
  show,
  children,
}: ModalProps) => {
  const [showModal, setShowModal] = useState<boolean>(show);

  useEffect(() => {
    setShowModal(show);
  }, [show]);

  return (
    <div
      className={clsx(
        'modal fixed inset-0 bg-gray-600 bg-opacity-50  w-full h-full outline-none overflow-x-hidden overflow-y-auto fade-in',
        showModal ? '' : 'hidden'
      )}
      tabIndex={-1}
      id='modal'
      aria-labelledby='modal'
      aria-modal='true'
      role='dialog'
    >
      <div className='modal-dialog modal-lg relative w-auto pointer-events-none'>
        <div className='modal-content border-none  relative flex flex-col w-full pointer-events-auto bg-white bg-clip-padding rounded-md outline-none text-current'>
          {children}
        </div>
      </div>
    </div>
  );
};

Modal.Header = ModalHeader;
Modal.Body = ModalBody;

export default Modal;
