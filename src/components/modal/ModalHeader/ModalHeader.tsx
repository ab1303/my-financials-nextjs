import React, { ReactNode } from 'react';

import ModalHeaderTitle from './ModalHeaderTitle';

type CommonComponents = {
  Title: typeof ModalHeaderTitle;
};

type ModalHeaderProps = {
  children?: ReactNode | undefined;
  onClose: () => void;
};

const ModalHeader: React.FC<ModalHeaderProps> & CommonComponents = ({
  children,
  onClose,
}: ModalHeaderProps) => (
  <div className='modal-header flex flex-shrink-0 items-center justify-between p-4 border-b border-gray-200 rounded-t-md'>
    {children}
    <button
      type='button'
      className='btn-close box-content w-4 h-4 p-1 text-black border-none rounded-none opacity-50 focus:shadow-none focus:outline-none focus:opacity-100 hover:text-black hover:opacity-75 hover:no-underline'
      data-bs-dismiss='modal'
      aria-label='Close'
      onClick={() => onClose()}
    ></button>
  </div>
);

ModalHeader.Title = ModalHeaderTitle;

export default ModalHeader;
