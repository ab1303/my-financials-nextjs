import React from 'react';
import clsx from 'clsx';

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
