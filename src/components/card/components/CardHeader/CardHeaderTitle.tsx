import React from 'react';

const CardHeaderTitle: React.FC<
  { children?: React.ReactNode } & React.ComponentPropsWithoutRef<'span'>
> = (props) => {
  return <span className=' text-xl font-semibold text-gray-600' {...props} />;
};

export default CardHeaderTitle;
