import React from 'react';

const CardBody: React.FC<{ children?: React.ReactNode }> = (props) => (
  <div className='shadow py-4 px-4' {...props}></div>
);

export default CardBody;
