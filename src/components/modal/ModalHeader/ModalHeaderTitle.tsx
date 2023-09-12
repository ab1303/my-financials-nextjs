import React, { ReactNode } from 'react';

const ModalHeaderTitle: React.FC = ({
  children,
}: {
  children?: ReactNode | undefined;
}) => {
  return (
    <h5 className='text-xl font-medium leading-normal text-gray-800'>
      {children}
    </h5>
  );
};

export default ModalHeaderTitle;
