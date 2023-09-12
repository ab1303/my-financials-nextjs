import React from 'react';

const ModalBody: React.FC<{ children?: React.ReactNode }> = (props) => (
  <div className='modal-body relative p-4' {...props}></div>
);

export default ModalBody;
