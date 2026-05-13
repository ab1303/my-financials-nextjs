import React from 'react';

type CardHeaderTextProps = {
  children?: React.ReactNode;
} & React.ComponentPropsWithoutRef<'span'>;

const CardHeaderText = ({ children, ...props }: CardHeaderTextProps) => {
  return (
    <span className='font-light text-gray-600 dark:text-gray-300' {...props}>
      {children}
    </span>
  );
};

export default CardHeaderText;
