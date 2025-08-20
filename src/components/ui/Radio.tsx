'use client';

import * as React from 'react';
import clsx from 'clsx';

export interface RadioProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, ...rest }, ref) => (
    <input
      ref={ref}
      type='radio'
      className={clsx(
        'h-4 w-4 cursor-pointer text-teal-600 focus:ring-teal-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700',
        className,
      )}
      {...rest}
    />
  ),
);
Radio.displayName = 'Radio';
