import React from 'react';

import CardBody from './components/CardBody';
import CardHeader from './components/CardHeader';

type CommonComponents = {
  Header: typeof CardHeader;
  Body: typeof CardBody;
};

const Card: React.FC<{ children?: React.ReactNode }> & CommonComponents = (
  props,
) => {
  return (
    <div
      className='bg-white shadow rounded-lg border border-gray-200 mt-6'
      {...props}
    />
  );
};

Card.Header = CardHeader;
Card.Body = CardBody;

export default Card;
