import clsx from 'clsx';
import React from 'react';

type TBodyTDProps = {
  children?: React.ReactNode;
  className?: string;
} & React.ComponentPropsWithoutRef<'td'>;

const TBodyTD = ({ children, className, ...rest }: TBodyTDProps) => {
  return (
    <td
      role='cell'
      className={clsx('px-6 py-2.5 whitespace-nowrap', className)}
      {...rest}
    >
      <span className='text-sm text-foreground'>{children}</span>
    </td>
  );
};

export default TBodyTD;
