'use client';

import * as React from 'react';
import clsx from 'clsx';

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  requiredIndicator?: boolean | React.ReactNode;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, requiredIndicator, ...rest }, ref) => {
    return (
      <label
        ref={ref}
        className={clsx(
          'block text-sm font-medium text-gray-700 dark:text-gray-200',
          className,
        )}
        {...rest}
      >
        <span className='inline-flex items-center gap-1'>
          {children}
          {requiredIndicator ? (
            requiredIndicator === true ? (
              <span className='text-red-500' aria-hidden='true'>
                *
              </span>
            ) : (
              requiredIndicator
            )
          ) : null}
        </span>
      </label>
    );
  },
);
Label.displayName = 'Label';
