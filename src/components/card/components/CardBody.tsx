import React from 'react';

const CardBody: React.FC<{ children?: React.ReactNode }> = (props) => (
  <div className='py-8 px-6 sm:px-10' {...props}></div>
);

export default CardBody;
