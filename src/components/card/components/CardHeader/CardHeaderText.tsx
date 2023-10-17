import React from 'react';

type CardHeaderTextProps = {
  children?: React.ReactNode;
} & React.ComponentPropsWithoutRef<'span'>;

const CardHeaderText = ({ children, ...props }: CardHeaderTextProps) => {
  return (
    <span className='font-light text-gray-600' {...props}>
      {children}
    </span>
  );
};

export default CardHeaderText;
